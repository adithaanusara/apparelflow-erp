import { eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { DEMO_ACCOUNTS } from "@/lib/demo-accounts";
import { ORDER_STATUSES, canTransition } from "@/lib/order-rules";
import type { Role } from "@/lib/roles";
import type { Database } from "@/server/db/client";
import { cuttingOrders, recipes, users, verificationItems, verificationLogs } from "@/server/db/schema";
import type { OrderSummary } from "@/server/orders/service";
import { createTestDb } from "./test-db";

let db: Database;

vi.mock("@/server/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db/client")>()),
  getDb: () => db,
}));

const { POST: login } = await import("@/app/api/auth/login/route");
const { GET: supervisorOrders, POST: createOrder } = await import("@/app/api/orders/route");
const { POST: submitOrder } = await import("@/app/api/orders/[id]/submit/route");
const { GET: pendingOrders } = await import("@/app/api/verification/orders/route");
const { PUT: putCounts } = await import("@/app/api/verification/orders/[id]/counts/route");
const { POST: approveRoute } = await import("@/app/api/verification/orders/[id]/approve/route");
const { POST: rejectRoute } = await import("@/app/api/verification/orders/[id]/reject/route");
const { GET: historyRoute } = await import("@/app/api/verification/history/route");

const cookies = {} as Record<Role, string>;
const userIds = {} as Record<Role, number>;
let blouseId: number;

function request(path: string, method: string, cookie?: string, body?: unknown) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const ctx = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) });

function saveCounts(role: Role | null, id: number | string, counts: unknown) {
  return putCounts(request(`/api/verification/orders/${id}/counts`, "PUT", role ? cookies[role] : undefined, { counts }), ctx(id));
}
function approve(role: Role | null, id: number | string, body?: unknown) {
  return approveRoute(request(`/api/verification/orders/${id}/approve`, "POST", role ? cookies[role] : undefined, body), ctx(id));
}
function reject(role: Role | null, id: number | string, body: unknown = { note: "Sleeve cuffs short by 4" }) {
  return rejectRoute(request(`/api/verification/orders/${id}/reject`, "POST", role ? cookies[role] : undefined, body), ctx(id));
}

// A 50-garment Casual Blouse order waiting at the QC station.
async function pendingOrder(): Promise<OrderSummary> {
  const created = await createOrder(
    request("/api/orders", "POST", cookies.cutting_supervisor, {
      recipeId: blouseId,
      targetQty: 50,
      fabricRollId: "FAB-ROLL-882",
      actualFabricYds: 94.5,
    }),
    undefined,
  );
  const { order } = await created.json();
  const submitted = await submitOrder(request(`/api/orders/${order.id}/submit`, "POST", cookies.cutting_supervisor), ctx(order.id));
  return (await submitted.json()).order;
}

// Counts every component, offsetting the named ones from the expected count.
async function countAll(order: OrderSummary, offsets: Record<string, number> = {}) {
  const counts = order.items.map((item) => ({
    componentId: item.componentId,
    actualQty: item.expectedQty + (offsets[item.componentName] ?? 0),
  }));
  const response = await saveCounts("cutting_verifier", order.id, counts);
  expect(response.status).toBe(200);
  return (await response.json()).order as OrderSummary;
}

async function statusOf(id: number) {
  const [row] = await db.select().from(cuttingOrders).where(eq(cuttingOrders.id, id));
  return row.status;
}

function logsFor(id: number) {
  return db.select().from(verificationLogs).where(eq(verificationLogs.orderId, id));
}

beforeAll(async () => {
  db = await createTestDb();
  [{ id: blouseId }] = await db.select({ id: recipes.id }).from(recipes).where(eq(recipes.recipeCode, "REC-BL01"));
  for (const account of DEMO_ACCOUNTS) {
    const response = await login(request("/api/auth/login", "POST", undefined, account), undefined);
    cookies[account.role] = response.headers.get("set-cookie")!.split(";")[0];
    [{ id: userIds[account.role] }] = await db.select({ id: users.id }).from(users).where(eq(users.email, account.email));
  }
});

describe("traffic-light counts", () => {
  it("derives GREEN, YELLOW and RED on the server", async () => {
    const order = await countAll(await pendingOrder(), { "Sleeve Cuffs": -4, "Collar & Stand": 3 });
    const statusByName = Object.fromEntries(order.items.map((item) => [item.componentName, item.status]));
    expect(statusByName).toEqual({
      "Front Body Panel": "GREEN",
      "Back Body Panel": "GREEN",
      "Sleeves (Left & Right)": "GREEN",
      "Collar & Stand": "YELLOW",
      "Sleeve Cuffs": "RED",
    });
  });

  it("ignores a status supplied by the client", async () => {
    const order = await pendingOrder();
    const [cuffs] = order.items.filter((item) => item.componentName === "Sleeve Cuffs");
    const response = await saveCounts("cutting_verifier", order.id, [
      { componentId: cuffs.componentId, actualQty: 10, status: "GREEN", expectedQty: 10 },
    ]);
    const saved = (await response.json()).order.items.find((item: { componentId: number }) => item.componentId === cuffs.componentId);
    expect(saved).toMatchObject({ actualQty: 10, expectedQty: 100, status: "RED" });
  });

  it("clears a count with null", async () => {
    const order = await countAll(await pendingOrder());
    const { componentId } = order.items[0];
    const response = await saveCounts("cutting_verifier", order.id, [{ componentId, actualQty: null }]);
    expect((await response.json()).order.items[0]).toMatchObject({ actualQty: null, status: null });
  });

  it.each([
    ["negative", -1],
    ["decimal", 49.5],
    ["numeric string", "50"],
    ["text", "abc"],
    ["missing", undefined],
    ["too large", 10_000_001],
  ])("rejects a %s count with 422 and stores nothing", async (_label, actualQty) => {
    const order = await pendingOrder();
    const { componentId } = order.items[0];
    const response = await saveCounts("cutting_verifier", order.id, [{ componentId, actualQty }]);
    expect(response.status).toBe(422);
    expect((await response.json()).error.fieldErrors[componentId]).toBeTruthy();
    const stored = await db.select().from(verificationItems).where(eq(verificationItems.orderId, order.id));
    expect(stored.every((item) => item.actualQty === null)).toBe(true);
  });

  it.each([
    ["an empty array", []],
    ["a non-array", { 1: 50 }],
    ["a duplicated component", [{ componentId: 1, actualQty: 1 }, { componentId: 1, actualQty: 2 }]],
    ["an invalid component id", [{ componentId: "1", actualQty: 1 }]],
    ["a component from another recipe", [{ componentId: 999_999, actualQty: 1 }]],
  ])("rejects %s with 422", async (_label, counts) => {
    const order = await pendingOrder();
    expect((await saveCounts("cutting_verifier", order.id, counts)).status).toBe(422);
  });

  it("refuses counts for an order that is not pending verification", async () => {
    const order = await countAll(await pendingOrder());
    await approve("cutting_verifier", order.id);
    const response = await saveCounts("cutting_verifier", order.id, [{ componentId: order.items[0].componentId, actualQty: 1 }]);
    expect(response.status).toBe(409);
  });
});

describe("approval (hard-stop gatekeeper)", () => {
  it("Test 1: lets a verifier approve an order with all GREEN components", async () => {
    const order = await countAll(await pendingOrder());
    const response = await approve("cutting_verifier", order.id);
    expect(response.status).toBe(200);
    expect((await response.json()).order.status).toBe("VERIFIED");

    const logs = await logsFor(order.id);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      decision: "APPROVED",
      verifierId: userIds.cutting_verifier,
      rejectionNote: null,
      wastagePct: 5,
    });
    expect(Date.now() - logs[0].timestamp.getTime()).toBeLessThan(60_000);
  });

  it("allows approval when a component is YELLOW (excess)", async () => {
    const order = await countAll(await pendingOrder(), { "Front Body Panel": 2 });
    expect((await approve("cutting_verifier", order.id)).status).toBe(200);
  });

  it("Test 2: blocks approval with 422 when one component is RED", async () => {
    const order = await countAll(await pendingOrder(), { "Sleeve Cuffs": -1 });
    const response = await approve("cutting_verifier", order.id);
    expect(response.status).toBe(422);

    const { error } = await response.json();
    expect(error.code).toBe("APPROVAL_BLOCKED");
    expect(Object.values(error.fieldErrors)).toEqual(["Sleeve Cuffs: Short by 1 (counted 99 of 100)."]);
    expect(await statusOf(order.id)).toBe("PENDING_VERIFICATION");
    expect(await logsFor(order.id)).toHaveLength(0);
  });

  it("blocks approval with 422 when nothing has been counted", async () => {
    const order = await pendingOrder();
    const response = await approve("cutting_verifier", order.id);
    expect(response.status).toBe(422);
    expect(Object.keys((await response.json()).error.fieldErrors)).toHaveLength(5);
    expect(await statusOf(order.id)).toBe("PENDING_VERIFICATION");
  });

  it("blocks approval with 422 when one component is left uncounted", async () => {
    const order = await countAll(await pendingOrder());
    await saveCounts("cutting_verifier", order.id, [{ componentId: order.items[2].componentId, actualQty: null }]);
    expect((await approve("cutting_verifier", order.id)).status).toBe(422);
  });

  it("blocks approval with 422 when a component row is missing", async () => {
    const order = await countAll(await pendingOrder());
    await db.delete(verificationItems).where(eq(verificationItems.orderId, order.id));
    expect((await approve("cutting_verifier", order.id)).status).toBe(422);
    expect(await statusOf(order.id)).toBe("PENDING_VERIFICATION");
  });

  it("cannot be talked into approving by the request body", async () => {
    const order = await countAll(await pendingOrder(), { "Sleeve Cuffs": -10 });
    const response = await approve("cutting_verifier", order.id, {
      force: true,
      status: "VERIFIED",
      items: order.items.map((item) => ({ ...item, actualQty: item.expectedQty, status: "GREEN" })),
    });
    expect(response.status).toBe(422);
  });

  it("takes the verifier from the session, not the request body", async () => {
    const order = await countAll(await pendingOrder());
    await approve("cutting_verifier", order.id, {
      verifierId: userIds.sewing_supervisor,
      timestamp: "2000-01-01T00:00:00Z",
      wastagePct: 0,
    });
    const [log] = await logsFor(order.id);
    expect(log.verifierId).toBe(userIds.cutting_verifier);
    expect(log.timestamp.getFullYear()).toBeGreaterThan(2000);
    expect(log.wastagePct).toBe(5);
  });

  it.each(["cutting_supervisor", "sewing_supervisor"] as const)(
    "Test 4: returns 403 when a %s tries to approve",
    async (role) => {
      const order = await countAll(await pendingOrder());
      expect((await approve(role, order.id)).status).toBe(403);
      expect(await statusOf(order.id)).toBe("PENDING_VERIFICATION");
      expect(await logsFor(order.id)).toHaveLength(0);
    },
  );

  it("returns 401 without a session", async () => {
    const order = await countAll(await pendingOrder());
    expect((await approve(null, order.id)).status).toBe(401);
  });

  it("approves only once, even for simultaneous requests", async () => {
    const order = await countAll(await pendingOrder());
    const statuses = (await Promise.all([approve("cutting_verifier", order.id), approve("cutting_verifier", order.id)])).map((r) => r.status);
    expect(statuses.sort()).toEqual([200, 409]);
    expect(await logsFor(order.id)).toHaveLength(1);
  });

  it("returns 409 for an order still being cut and 404 for an unknown order", async () => {
    const created = await createOrder(
      request("/api/orders", "POST", cookies.cutting_supervisor, { recipeId: blouseId, targetQty: 5, fabricRollId: "R-1", actualFabricYds: 9 }),
      undefined,
    );
    const { order } = await created.json();
    expect((await approve("cutting_verifier", order.id)).status).toBe(409);
    expect((await approve("cutting_verifier", 999_999)).status).toBe(404);
  });
});

describe("rejection", () => {
  it.each([
    ["no body field", {}],
    ["an empty note", { note: "" }],
    ["a whitespace note", { note: "   \n\t " }],
    ["a non-string note", { note: 42 }],
    ["a null note", { note: null }],
    ["a note that is too long", { note: "x".repeat(501) }],
  ])("Test 3: refuses a rejection with %s", async (_label, body) => {
    const order = await pendingOrder();
    const response = await reject("cutting_verifier", order.id, body);
    expect(response.status).toBe(422);
    expect((await response.json()).error.fieldErrors.note).toBeTruthy();
    expect(await statusOf(order.id)).toBe("PENDING_VERIFICATION");
    expect(await logsFor(order.id)).toHaveLength(0);
  });

  it("returns the batch to the supervisor with the reason", async () => {
    const order = await countAll(await pendingOrder(), { "Sleeve Cuffs": -4 });
    const response = await reject("cutting_verifier", order.id, { note: "  Sleeve cuffs short by 4  " });
    expect(response.status).toBe(200);
    expect(await statusOf(order.id)).toBe("REJECTED");

    const [log] = await logsFor(order.id);
    expect(log).toMatchObject({
      decision: "REJECTED",
      rejectionNote: "Sleeve cuffs short by 4",
      verifierId: userIds.cutting_verifier,
    });

    const list = await supervisorOrders(request("/api/orders", "GET", cookies.cutting_supervisor), undefined);
    const seen = (await list.json()).orders.find((o: OrderSummary) => o.id === order.id);
    expect(seen.latestRejection).toMatchObject({ note: "Sleeve cuffs short by 4", verifierName: "Demo Cutting Verifier" });
    expect(seen.items.find((item: { componentName: string }) => item.componentName === "Sleeve Cuffs").status).toBe("RED");
  });

  it("can reject an order whose components are all GREEN", async () => {
    const order = await countAll(await pendingOrder());
    expect((await reject("cutting_verifier", order.id, { note: "Fabric shade mismatch" })).status).toBe(200);
  });

  it.each(["cutting_supervisor", "sewing_supervisor"] as const)("returns 403 when a %s tries to reject", async (role) => {
    const order = await pendingOrder();
    expect((await reject(role, order.id)).status).toBe(403);
    expect(await statusOf(order.id)).toBe("PENDING_VERIFICATION");
  });

  it("supports the full reject, re-cut, recount and approve loop", async () => {
    const order = await countAll(await pendingOrder(), { "Sleeve Cuffs": -4 });
    await reject("cutting_verifier", order.id);
    expect((await approve("cutting_verifier", order.id)).status).toBe(409);

    await submitOrder(request(`/api/orders/${order.id}/submit`, "POST", cookies.cutting_supervisor), ctx(order.id));
    expect((await approve("cutting_verifier", order.id)).status).toBe(422);

    await countAll(order);
    expect((await approve("cutting_verifier", order.id)).status).toBe(200);
    expect((await logsFor(order.id)).map((log) => log.decision)).toEqual(["REJECTED", "APPROVED"]);
    expect((await reject("cutting_verifier", order.id)).status).toBe(409);
  });
});

describe("verifier queue", () => {
  it("lists only orders pending verification", async () => {
    const pending = await pendingOrder();
    const approved = await countAll(await pendingOrder());
    await approve("cutting_verifier", approved.id);

    const response = await pendingOrders(request("/api/verification/orders?status=VERIFIED", "GET", cookies.cutting_verifier), undefined);
    const { orders } = await response.json();
    expect(orders.every((order: OrderSummary) => order.status === "PENDING_VERIFICATION")).toBe(true);
    expect(orders.map((order: OrderSummary) => order.id)).toContain(pending.id);
    expect(orders.map((order: OrderSummary) => order.id)).not.toContain(approved.id);
  });

  it.each(["cutting_supervisor", "sewing_supervisor"] as const)("is forbidden for %s", async (role) => {
    const response = await pendingOrders(request("/api/verification/orders", "GET", cookies[role]), undefined);
    expect(response.status).toBe(403);
  });

  it.each(["cutting_supervisor", "sewing_supervisor"] as const)("does not let a %s save counts", async (role) => {
    const order = await pendingOrder();
    expect((await saveCounts(role, order.id, [{ componentId: order.items[0].componentId, actualQty: 50 }])).status).toBe(403);
  });
});

describe("GET /api/verification/history", () => {
  type Entry = { id: number; orderNo: string; decision: string };

  async function history(role: Role | null = "cutting_verifier", query = "") {
    const response = await historyRoute(request(`/api/verification/history${query}`, "GET", role ? cookies[role] : undefined), undefined);
    return { status: response.status, body: await response.json() };
  }

  it("lists the verifier's own approvals and rejections, newest first, with the audit details", async () => {
    const before = (await history()).body;

    const approved = await countAll(await pendingOrder());
    await approve("cutting_verifier", approved.id);
    const rejected = await countAll(await pendingOrder(), { "Sleeve Cuffs": -4 });
    await reject("cutting_verifier", rejected.id, { note: "Sleeve cuffs short by 4" });

    const { status, body } = await history();
    expect(status).toBe(200);
    expect(body.approved).toBe(before.approved + 1);
    expect(body.rejected).toBe(before.rejected + 1);
    expect(body.history.rejected[0]).toMatchObject({
      orderNo: rejected.orderNo,
      decision: "REJECTED",
      rejectionNote: "Sleeve cuffs short by 4",
      recipeName: "Casual Blouse",
      recipeCode: "REC-BL01",
      supervisorName: "Demo Cutting Supervisor",
      targetQty: 50,
    });
    expect(body.history.approved[0]).toMatchObject({ orderNo: approved.orderNo, decision: "APPROVED", rejectionNote: null, wastagePct: 5 });

    // Each list holds one kind of decision only, newest first, and is capped.
    for (const [kind, entries] of [["APPROVED", body.history.approved], ["REJECTED", body.history.rejected]] as [string, Entry[]][]) {
      expect(entries.every((entry) => entry.decision === kind)).toBe(true);
      expect(entries.map((entry) => entry.id)).toEqual(entries.map((entry) => entry.id).sort((a, b) => b - a));
      expect(entries.length).toBeLessThanOrEqual(25);
    }
    expect(JSON.stringify(body)).not.toMatch(/hash|verifierId/i);
  });

  it("counts batches waiting for verification", async () => {
    const before = (await history()).body.pending;
    const order = await pendingOrder();
    expect((await history()).body.pending).toBe(before + 1);
    await countAll(order);
    await approve("cutting_verifier", order.id);
    expect((await history()).body.pending).toBe(before);
  });

  it("never includes another verifier's decisions, whatever the query string asks for", async () => {
    const [other] = await db
      .insert(users)
      .values({ email: "second.verifier@apparelflow.demo", passwordHash: "not-a-real-hash", role: "cutting_verifier", fullName: "Second Verifier" })
      .returning();
    const order = await pendingOrder();
    await db.update(cuttingOrders).set({ status: "REJECTED" }).where(eq(cuttingOrders.id, order.id));
    await db.insert(verificationLogs).values({ orderId: order.id, verifierId: other.id, decision: "REJECTED", rejectionNote: "Rejected by someone else", wastagePct: 5 });

    const mine = await history();
    for (const query of [`?verifierId=${other.id}`, "?verifierId=all", `?userId=${other.id}&all=true`]) {
      const { body } = await history("cutting_verifier", query);
      expect(body).toEqual(mine.body);
      expect(JSON.stringify(body)).not.toContain("Rejected by someone else");
      const listed = [...body.history.approved, ...body.history.rejected].map((entry: Entry) => entry.orderNo);
      expect(listed).not.toContain(order.orderNo);
    }
  });

  it.each(["cutting_supervisor", "sewing_supervisor"] as const)("returns 403 for %s", async (role) => {
    const { status, body } = await history(role);
    expect(status).toBe(403);
    expect(JSON.stringify(body)).not.toMatch(/CO-|history/);
  });

  it("returns 401 without a session", async () => {
    expect((await history(null)).status).toBe(401);
  });
});

// These bypass the API on purpose and write straight to the database, the way
// a bug or a manual query would.
describe("database triggers", () => {
  const setStatus = (id: number, status: (typeof ORDER_STATUSES)[number]) =>
    db.update(cuttingOrders).set({ status }).where(eq(cuttingOrders.id, id));

  // Drizzle wraps driver errors, so the trigger's message is on the cause.
  async function rejectionMessage(query: PromiseLike<unknown>): Promise<string> {
    try {
      await query;
    } catch (error) {
      return String((error as { cause?: unknown }).cause ?? error);
    }
    return "the query was not rejected";
  }

  async function approvedOrder() {
    const order = await countAll(await pendingOrder(), { "Collar & Stand": 3 });
    await approve("cutting_verifier", order.id);
    return order;
  }

  it("refuses a direct UPDATE to VERIFIED while a component is short", async () => {
    const order = await countAll(await pendingOrder(), { "Sleeve Cuffs": -1 });
    expect(await rejectionMessage(setStatus(order.id, "VERIFIED"))).toMatch(/uncounted or short/);
    expect(await statusOf(order.id)).toBe("PENDING_VERIFICATION");
  });

  it("refuses a direct UPDATE to VERIFIED while a component is uncounted", async () => {
    const order = await pendingOrder();
    expect(await rejectionMessage(setStatus(order.id, "VERIFIED"))).toMatch(/uncounted or short/);
  });

  it("refuses a new order inserted with any status but CUTTING_IN_PROGRESS", async () => {
    const insert = db.insert(cuttingOrders).values({
      orderNo: "FORGED-1",
      recipeId: blouseId,
      targetQty: 1,
      fabricRollId: "X",
      actualFabricYds: 1,
      status: "VERIFIED",
      createdBy: userIds.cutting_supervisor,
    });
    expect(await rejectionMessage(insert)).toMatch(/must start as CUTTING_IN_PROGRESS/);
  });

  it("allows exactly the transitions the application state machine allows", async () => {
    // Puts a fresh order into `from` using only legal moves.
    async function orderIn(from: (typeof ORDER_STATUSES)[number]) {
      const created = await createOrder(
        request("/api/orders", "POST", cookies.cutting_supervisor, { recipeId: blouseId, targetQty: 2, fabricRollId: "R-2", actualFabricYds: 3.6 }),
        undefined,
      );
      const { id } = (await created.json()).order;
      if (from === "CUTTING_IN_PROGRESS") return id;
      await setStatus(id, "PENDING_VERIFICATION");
      // All counted and matching, so only the transition rule is under test.
      await db.update(verificationItems).set({ actualQty: sql`expected_qty`, status: "GREEN" }).where(eq(verificationItems.orderId, id));
      if (from !== "PENDING_VERIFICATION") await setStatus(id, from);
      return id as number;
    }

    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        if (from === to) continue;
        const id = await orderIn(from);
        const message = await rejectionMessage(setStatus(id, to));
        const allowed = message === "the query was not rejected";
        expect(allowed, `${from} -> ${to}`).toBe(canTransition(from, to));
      }
    }
  });

  it("makes the audit log append-only", async () => {
    const order = await approvedOrder();
    const where = eq(verificationLogs.orderId, order.id);

    expect(await rejectionMessage(db.update(verificationLogs).set({ verifierId: userIds.sewing_supervisor }).where(where))).toMatch(/append-only/);
    expect(await rejectionMessage(db.update(verificationLogs).set({ wastagePct: 0 }).where(where))).toMatch(/append-only/);
    expect(await rejectionMessage(db.delete(verificationLogs).where(where))).toMatch(/append-only/);
    expect(await rejectionMessage(db.execute(sql`TRUNCATE verification_logs`))).toMatch(/append-only/);

    const [log] = await logsFor(order.id);
    expect(log).toMatchObject({ verifierId: userIds.cutting_verifier, wastagePct: 5 });
  });

  it("freezes the counts and batch data of a VERIFIED order", async () => {
    const order = await approvedOrder();
    const items = eq(verificationItems.orderId, order.id);
    const row = eq(cuttingOrders.id, order.id);

    expect(await rejectionMessage(db.update(verificationItems).set({ actualQty: 1, status: "RED" }).where(items))).toMatch(/immutable/);
    expect(await rejectionMessage(db.delete(verificationItems).where(items))).toMatch(/immutable/);
    expect(await rejectionMessage(db.update(cuttingOrders).set({ actualFabricYds: 1 }).where(row))).toMatch(/immutable/);
    expect(await rejectionMessage(db.update(cuttingOrders).set({ targetQty: 1 }).where(row))).toMatch(/immutable/);
    expect(await rejectionMessage(db.delete(cuttingOrders).where(row))).toMatch(/VERIFIED|violates/);

    const stored = await db.select().from(verificationItems).where(items);
    expect(stored.find((item) => item.status === "YELLOW")?.actualQty).toBe(53);
  });
});
