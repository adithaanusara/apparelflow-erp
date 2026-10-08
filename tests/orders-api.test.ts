import { eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { DEMO_ACCOUNTS } from "@/lib/demo-accounts";
import type { Role } from "@/lib/roles";
import type { Database } from "@/server/db/client";
import { cuttingOrders, recipes, users, verificationItems } from "@/server/db/schema";
import { createTestDb, signOff } from "./test-db";

let db: Database;

vi.mock("@/server/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db/client")>()),
  getDb: () => db,
}));

const { POST: login } = await import("@/app/api/auth/login/route");
const { GET: me } = await import("@/app/api/auth/me/route");
const { GET: listOrders, POST: createOrder } = await import("@/app/api/orders/route");
const { POST: submitOrder } = await import("@/app/api/orders/[id]/submit/route");
const { PUT: updateOrder, DELETE: deleteOrder } = await import("@/app/api/orders/[id]/route");
const { GET: listRecipes } = await import("@/app/api/recipes/route");

const BASE = "http://localhost";
const cookies = {} as Record<Role, string>;
let blouseId: number;

function request(
  path: string,
  options: { method?: string; cookie?: string; body?: unknown; rawBody?: string; contentType?: string } = {},
) {
  const headers = new Headers();
  if (options.cookie) headers.set("cookie", options.cookie);
  const body = options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body));
  if (body !== undefined) headers.set("content-type", options.contentType ?? "application/json");
  return new NextRequest(`${BASE}${path}`, { method: options.method ?? "GET", headers, body });
}

function postOrder(cookie: string | undefined, body: unknown) {
  return createOrder(request("/api/orders", { method: "POST", cookie, body }), undefined);
}

function submit(cookie: string | undefined, id: number | string) {
  return submitOrder(request(`/api/orders/${id}/submit`, { method: "POST", cookie, body: {} }), {
    params: Promise.resolve({ id: String(id) }),
  });
}

const validOrder = () => ({
  recipeId: blouseId,
  targetQty: 50,
  fabricRollId: "FAB-ROLL-882",
  actualFabricYds: 94.5,
});

beforeAll(async () => {
  db = await createTestDb();
  [{ id: blouseId }] = await db.select({ id: recipes.id }).from(recipes).where(eq(recipes.recipeCode, "REC-BL01"));

  for (const account of DEMO_ACCOUNTS) {
    const response = await login(
      request("/api/auth/login", { method: "POST", body: { email: account.email, password: account.password } }),
      undefined,
    );
    expect(response.status).toBe(200);
    cookies[account.role] = response.headers.get("set-cookie")!.split(";")[0];
  }
});

describe("authentication", () => {
  it("issues an httpOnly session cookie and never returns the password hash", async () => {
    const response = await login(
      request("/api/auth/login", {
        method: "POST",
        body: { email: "  Supervisor@ApparelFlow.demo ", password: "Supervisor@123" },
      }),
      undefined,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(/af_session=.+HttpOnly/i);
    const body = await response.json();
    expect(body.user.role).toBe("cutting_supervisor");
    expect(JSON.stringify(body)).not.toMatch(/hash/i);
  });

  it.each([
    ["a wrong password", { email: "supervisor@apparelflow.demo", password: "nope" }, 401],
    ["an unknown email", { email: "ghost@apparelflow.demo", password: "Supervisor@123" }, 401],
    ["an empty payload", {}, 422],
    ["non-string credentials", { email: 1, password: ["x"] }, 422],
  ])("rejects %s", async (_label, body, status) => {
    const response = await login(request("/api/auth/login", { method: "POST", body }), undefined);
    expect(response.status).toBe(status);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("returns the session user from the cookie", async () => {
    const response = await me(request("/api/auth/me", { cookie: cookies.cutting_verifier }), undefined);
    expect((await response.json()).user.role).toBe("cutting_verifier");
  });

  it("treats a tampered or forged cookie as signed out", async () => {
    const [header, payload, signature] = cookies.cutting_verifier.replace("af_session=", "").split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), role: "cutting_supervisor" }),
    ).toString("base64url");
    const unsigned = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${forgedPayload}.`;

    for (const token of [`${header}.${forgedPayload}.${signature}`, unsigned, "garbage"]) {
      const response = await postOrder(`af_session=${token}`, validOrder());
      expect(response.status).toBe(401);
    }
  });
});

describe("POST /api/orders", () => {
  it("creates an order with server-derived expected counts", async () => {
    const response = await postOrder(cookies.cutting_supervisor, validOrder());
    expect(response.status).toBe(201);
    const { order } = await response.json();

    expect(order.orderNo).toBe(`CO-${String(order.id).padStart(6, "0")}`);
    expect(order.status).toBe("CUTTING_IN_PROGRESS");
    expect(order.createdByName).toBe("Demo Cutting Supervisor");
    expect(order.expectedFabricYds).toBe(90);
    expect(order.wastagePct).toBe(5);
    expect(Object.fromEntries(order.items.map((i: { componentName: string; expectedQty: number }) => [i.componentName, i.expectedQty]))).toEqual({
      "Front Body Panel": 50,
      "Back Body Panel": 50,
      "Sleeves (Left & Right)": 100,
      "Collar & Stand": 50,
      "Sleeve Cuffs": 100,
    });

    const stored = await db.select().from(verificationItems).where(eq(verificationItems.orderId, order.id));
    expect(stored).toHaveLength(5);
    expect(stored.every((item) => item.actualQty === null && item.status === null)).toBe(true);
  });

  it("ignores client-supplied status, creator, order number and counts", async () => {
    const [verifier] = await db.select().from(users).where(eq(users.role, "cutting_verifier"));
    const response = await postOrder(cookies.cutting_supervisor, {
      ...validOrder(),
      status: "VERIFIED",
      createdBy: verifier.id,
      orderNo: "HACKED",
      items: [{ expectedQty: 1 }],
    });
    const { order } = await response.json();
    const [row] = await db.select().from(cuttingOrders).where(eq(cuttingOrders.id, order.id));

    expect(row.status).toBe("CUTTING_IN_PROGRESS");
    expect(row.orderNo).toMatch(/^CO-\d{6}$/);
    expect(row.createdBy).not.toBe(verifier.id);
    expect(order.items).toHaveLength(5);
  });

  it("returns 401 without a session", async () => {
    expect((await postOrder(undefined, validOrder())).status).toBe(401);
  });

  it.each(["cutting_verifier", "sewing_supervisor"] as const)("returns 403 for %s", async (role) => {
    const before = await db.$count(cuttingOrders);
    expect((await postOrder(cookies[role], validOrder())).status).toBe(403);
    expect(await db.$count(cuttingOrders)).toBe(before);
  });

  it.each([
    ["negative quantity", { targetQty: -5 }, "targetQty"],
    ["decimal quantity", { targetQty: 2.5 }, "targetQty"],
    ["string quantity", { targetQty: "50" }, "targetQty"],
    ["zero fabric", { actualFabricYds: 0 }, "actualFabricYds"],
    ["blank roll id", { fabricRollId: "  " }, "fabricRollId"],
    ["unknown recipe", { recipeId: 999_999 }, "recipeId"],
    ["implausible fabric", { targetQty: 1, actualFabricYds: 500 }, "actualFabricYds"],
  ])("returns 422 with a field error for %s", async (_label, overrides, field) => {
    const before = await db.$count(cuttingOrders);
    const response = await postOrder(cookies.cutting_supervisor, { ...validOrder(), ...overrides });
    expect(response.status).toBe(422);
    expect((await response.json()).error.fieldErrors[field]).toBeTruthy();
    expect(await db.$count(cuttingOrders)).toBe(before);
  });

  it("returns 422 listing every field for an empty payload", async () => {
    const response = await postOrder(cookies.cutting_supervisor, {});
    expect(response.status).toBe(422);
    expect(Object.keys((await response.json()).error.fieldErrors)).toHaveLength(4);
  });

  it.each([
    ["malformed JSON", { rawBody: "{not json" }, 400],
    ["a JSON array", { rawBody: "[]" }, 400],
    ["a form-encoded body", { rawBody: "targetQty=50", contentType: "application/x-www-form-urlencoded" }, 415],
  ])("rejects %s", async (_label, options, status) => {
    const response = await createOrder(
      request("/api/orders", { method: "POST", cookie: cookies.cutting_supervisor, ...options }),
      undefined,
    );
    expect(response.status).toBe(status);
  });
});

describe("POST /api/orders/:id/submit", () => {
  async function newOrderId() {
    const response = await postOrder(cookies.cutting_supervisor, validOrder());
    return (await response.json()).order.id as number;
  }

  it("moves an order to PENDING_VERIFICATION exactly once", async () => {
    const id = await newOrderId();

    const first = await submit(cookies.cutting_supervisor, id);
    expect(first.status).toBe(200);
    expect((await first.json()).order.status).toBe("PENDING_VERIFICATION");

    const second = await submit(cookies.cutting_supervisor, id);
    expect(second.status).toBe(409);
    expect((await second.json()).error.code).toBe("INVALID_TRANSITION");
  });

  it("lets only one of two simultaneous submissions succeed", async () => {
    const id = await newOrderId();
    const statuses = (
      await Promise.all([submit(cookies.cutting_supervisor, id), submit(cookies.cutting_supervisor, id)])
    ).map((response) => response.status);
    expect(statuses.sort()).toEqual([200, 409]);
  });

  it("refuses to resubmit a VERIFIED order", async () => {
    const id = await newOrderId();
    await submit(cookies.cutting_supervisor, id);
    await db.update(verificationItems).set({ actualQty: sql`expected_qty`, status: "GREEN" }).where(eq(verificationItems.orderId, id));
    await signOff(db, id, "APPROVED");
    expect((await submit(cookies.cutting_supervisor, id)).status).toBe(409);
  });

  it("resubmits a REJECTED order and clears the previous counts", async () => {
    const id = await newOrderId();
    await submit(cookies.cutting_supervisor, id);
    await db.update(verificationItems).set({ actualQty: 0, status: "RED" }).where(eq(verificationItems.orderId, id));
    await signOff(db, id, "REJECTED");

    expect((await submit(cookies.cutting_supervisor, id)).status).toBe(200);
    const items = await db.select().from(verificationItems).where(eq(verificationItems.orderId, id));
    expect(items.every((item) => item.actualQty === null && item.status === null)).toBe(true);
  });

  it.each(["cutting_verifier", "sewing_supervisor"] as const)("returns 403 for %s", async (role) => {
    const id = await newOrderId();
    expect((await submit(cookies[role], id)).status).toBe(403);
    const [row] = await db.select().from(cuttingOrders).where(eq(cuttingOrders.id, id));
    expect(row.status).toBe("CUTTING_IN_PROGRESS");
  });

  it.each([999_999, "abc", "1 OR 1=1", "-1"])("returns 404 for order id %j", async (id) => {
    expect((await submit(cookies.cutting_supervisor, id)).status).toBe(404);
  });
});

describe("PUT /api/orders/:id (edit before verification)", () => {
  const ctx = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) });
  const edit = (cookie: string | undefined, id: number | string, body: unknown) =>
    updateOrder(request(`/api/orders/${id}`, { method: "PUT", cookie, body }), ctx(id));

  async function newOrder() {
    const response = await postOrder(cookies.cutting_supervisor, validOrder());
    return (await response.json()).order;
  }
  const itemsOf = (id: number) => db.select().from(verificationItems).where(eq(verificationItems.orderId, id));
  const rowOf = async (id: number) => (await db.select().from(cuttingOrders).where(eq(cuttingOrders.id, id)))[0];

  // Takes an order through submission and a rejection with one short component.
  async function rejectedOrder() {
    const order = await newOrder();
    await submit(cookies.cutting_supervisor, order.id);
    await db.update(verificationItems).set({ actualQty: 1, status: "RED" }).where(eq(verificationItems.orderId, order.id));
    await signOff(db, order.id, "REJECTED");
    return order;
  }

  it("corrects every field of an unsubmitted order and rebuilds the expected counts", async () => {
    const order = await newOrder();
    const response = await edit(cookies.cutting_supervisor, order.id, {
      recipeId: blouseId,
      targetQty: 20,
      fabricRollId: "fab-roll-900",
      actualFabricYds: 37,
    });
    expect(response.status).toBe(200);

    const { order: updated } = await response.json();
    expect(updated).toMatchObject({
      id: order.id,
      orderNo: order.orderNo,
      status: "CUTTING_IN_PROGRESS",
      targetQty: 20,
      fabricRollId: "FAB-ROLL-900",
      actualFabricYds: 37,
      expectedFabricYds: 36,
      wastagePct: 2.78,
    });
    expect(updated.items.map((item: { expectedQty: number }) => item.expectedQty).sort()).toEqual([20, 20, 20, 40, 40]);
    expect(await itemsOf(order.id)).toHaveLength(5);
  });

  it("swaps the checklist when the recipe changes", async () => {
    const order = await newOrder();
    const [cropTop] = await db.select().from(recipes).where(eq(recipes.recipeCode, "REC-CT02"));
    const response = await edit(cookies.cutting_supervisor, order.id, { ...validOrder(), recipeId: cropTop.id, actualFabricYds: 58 });
    const { order: updated } = await response.json();

    expect(updated.recipe.recipeCode).toBe("REC-CT02");
    expect(updated.items.map((item: { componentName: string }) => item.componentName)).toContain("Side Strap Accents");
    expect(updated.items.map((item: { componentName: string }) => item.componentName)).not.toContain("Sleeve Cuffs");
    expect(await itemsOf(order.id)).toHaveLength(5);
  });

  it("ignores status, creator and order number in the body", async () => {
    const order = await newOrder();
    await edit(cookies.cutting_supervisor, order.id, { ...validOrder(), status: "VERIFIED", orderNo: "HACKED", createdBy: 999 });
    expect(await rowOf(order.id)).toMatchObject({ status: "CUTTING_IN_PROGRESS", orderNo: order.orderNo });
  });

  it.each([
    ["negative quantity", { targetQty: -1 }, "targetQty"],
    ["decimal quantity", { targetQty: 1.5 }, "targetQty"],
    ["empty roll id", { fabricRollId: "" }, "fabricRollId"],
    ["zero fabric", { actualFabricYds: 0 }, "actualFabricYds"],
    ["unknown recipe", { recipeId: 999_999 }, "recipeId"],
  ])("returns 422 for %s and changes nothing", async (_label, overrides, field) => {
    const order = await newOrder();
    const response = await edit(cookies.cutting_supervisor, order.id, { ...validOrder(), ...overrides });
    expect(response.status).toBe(422);
    expect((await response.json()).error.fieldErrors[field]).toBeTruthy();
    expect(await rowOf(order.id)).toMatchObject({ targetQty: 50, fabricRollId: "FAB-ROLL-882", actualFabricYds: 94.5 });
  });

  it("lets a rejected order's fabric be corrected for the re-cut, keeping the verifier's counts", async () => {
    const order = await rejectedOrder();
    const response = await edit(cookies.cutting_supervisor, order.id, { ...validOrder(), fabricRollId: "FAB-ROLL-883", actualFabricYds: 99 });
    expect(response.status).toBe(200);

    const { order: updated } = await response.json();
    expect(updated).toMatchObject({ status: "REJECTED", fabricRollId: "FAB-ROLL-883", actualFabricYds: 99, wastagePct: 10 });
    expect((await itemsOf(order.id)).every((item) => item.actualQty === 1 && item.status === "RED")).toBe(true);
  });

  it("refuses to change the quantity or recipe of a rejected order", async () => {
    const order = await rejectedOrder();
    const [cropTop] = await db.select().from(recipes).where(eq(recipes.recipeCode, "REC-CT02"));

    for (const [field, overrides] of [
      ["targetQty", { targetQty: 40 }],
      ["recipeId", { recipeId: cropTop.id }],
    ] as const) {
      const response = await edit(cookies.cutting_supervisor, order.id, { ...validOrder(), ...overrides });
      expect(response.status).toBe(422);
      expect((await response.json()).error.fieldErrors[field]).toMatch(/after a rejection/);
    }
    expect(await rowOf(order.id)).toMatchObject({ targetQty: 50, recipeId: blouseId });
    expect((await itemsOf(order.id)).every((item) => item.status === "RED")).toBe(true);
  });

  it("returns 409 once the order is with the verifier or verified", async () => {
    const order = await newOrder();
    await submit(cookies.cutting_supervisor, order.id);
    expect((await edit(cookies.cutting_supervisor, order.id, { ...validOrder(), targetQty: 1 })).status).toBe(409);

    await db.update(verificationItems).set({ actualQty: sql`expected_qty`, status: "GREEN" }).where(eq(verificationItems.orderId, order.id));
    await signOff(db, order.id, "APPROVED");
    const response = await edit(cookies.cutting_supervisor, order.id, { ...validOrder(), actualFabricYds: 90 });
    expect(response.status).toBe(409);
    expect(await rowOf(order.id)).toMatchObject({ targetQty: 50, actualFabricYds: 94.5 });
  });

  it.each(["cutting_verifier", "sewing_supervisor"] as const)("returns 403 for %s", async (role) => {
    const order = await newOrder();
    expect((await edit(cookies[role], order.id, { ...validOrder(), targetQty: 1 })).status).toBe(403);
    expect((await rowOf(order.id)).targetQty).toBe(50);
  });

  it("returns 401 without a session and 404 for an unknown order", async () => {
    const order = await newOrder();
    expect((await edit(undefined, order.id, validOrder())).status).toBe(401);
    expect((await edit(cookies.cutting_supervisor, 999_999, validOrder())).status).toBe(404);
  });
});

describe("DELETE /api/orders/:id", () => {
  const ctx = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) });
  const remove = (cookie: string | undefined, id: number | string) =>
    deleteOrder(request(`/api/orders/${id}`, { method: "DELETE", cookie }), ctx(id));

  async function newOrderId() {
    const response = await postOrder(cookies.cutting_supervisor, validOrder());
    return (await response.json()).order.id as number;
  }
  const exists = async (id: number) => (await db.select().from(cuttingOrders).where(eq(cuttingOrders.id, id))).length === 1;

  it("removes an order that was never submitted, with its checklist", async () => {
    const id = await newOrderId();
    const response = await remove(cookies.cutting_supervisor, id);
    expect(response.status).toBe(204);
    expect(await exists(id)).toBe(false);
    expect(await db.select().from(verificationItems).where(eq(verificationItems.orderId, id))).toHaveLength(0);
    expect((await remove(cookies.cutting_supervisor, id)).status).toBe(404);
  });

  it("returns 409 once the order has been submitted, rejected or verified", async () => {
    const id = await newOrderId();
    await submit(cookies.cutting_supervisor, id);
    expect((await remove(cookies.cutting_supervisor, id)).status).toBe(409);

    await signOff(db, id, "REJECTED");
    expect((await remove(cookies.cutting_supervisor, id)).status).toBe(409);

    await db.update(cuttingOrders).set({ status: "PENDING_VERIFICATION" }).where(eq(cuttingOrders.id, id));
    await db.update(verificationItems).set({ actualQty: sql`expected_qty`, status: "GREEN" }).where(eq(verificationItems.orderId, id));
    await signOff(db, id, "APPROVED");
    expect((await remove(cookies.cutting_supervisor, id)).status).toBe(409);
    expect(await exists(id)).toBe(true);
  });

  it.each(["cutting_verifier", "sewing_supervisor"] as const)("returns 403 for %s", async (role) => {
    const id = await newOrderId();
    expect((await remove(cookies[role], id)).status).toBe(403);
    expect(await exists(id)).toBe(true);
  });

  it("returns 401 without a session", async () => {
    const id = await newOrderId();
    expect((await remove(undefined, id)).status).toBe(401);
    expect(await exists(id)).toBe(true);
  });
});

describe("read endpoints", () => {
  it("lists orders and recipes for the cutting supervisor", async () => {
    const orders = await listOrders(request("/api/orders", { cookie: cookies.cutting_supervisor }), undefined);
    expect((await orders.json()).orders.length).toBeGreaterThan(0);

    const recipeList = await listRecipes(request("/api/recipes", { cookie: cookies.cutting_supervisor }), undefined);
    const body = await recipeList.json();
    expect(body.recipes.map((r: { recipeCode: string }) => r.recipeCode)).toEqual(["REC-BL01", "REC-CT02"]);
    expect(body.recipes[0].components).toHaveLength(5);
  });

  it.each(["cutting_verifier", "sewing_supervisor"] as const)("hides the order list from %s", async (role) => {
    const response = await listOrders(request("/api/orders", { cookie: cookies[role] }), undefined);
    expect(response.status).toBe(403);
    expect(JSON.stringify(await response.json())).not.toContain("CO-");
  });

  it("returns 401 for the order list without a session", async () => {
    expect((await listOrders(request("/api/orders"), undefined)).status).toBe(401);
  });
});
