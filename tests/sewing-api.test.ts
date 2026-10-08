import { eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { DEMO_ACCOUNTS } from "@/lib/demo-accounts";
import type { Role } from "@/lib/roles";
import type { Database } from "@/server/db/client";
import {
  cuttingOrders,
  recipes,
  users,
  verificationItems,
} from "@/server/db/schema";
import type { OrderSummary } from "@/server/orders/service";
import type { SewingBatch } from "@/server/sewing/service";
import { createTestDb } from "./test-db";

let db: Database;

vi.mock("@/server/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db/client")>()),
  getDb: () => db,
}));

const { POST: login } = await import("@/app/api/auth/login/route");
const { POST: createOrder } = await import("@/app/api/orders/route");
const { POST: submitOrder } =
  await import("@/app/api/orders/[id]/submit/route");
const { PUT: putCounts } =
  await import("@/app/api/verification/orders/[id]/counts/route");
const { POST: approveRoute } =
  await import("@/app/api/verification/orders/[id]/approve/route");
const { POST: rejectRoute } =
  await import("@/app/api/verification/orders/[id]/reject/route");
const { GET: queueRoute } = await import("@/app/api/sewing/queue/route");
const { POST: startRoute } =
  await import("@/app/api/sewing/queue/[id]/start/route");
const { POST: completeRoute } =
  await import("@/app/api/sewing/queue/[id]/complete/route");

const cookies = {} as Record<Role, string>;
const userIds = {} as Record<Role, number>;
let blouseId: number;

function request(
  path: string,
  method: string,
  role: Role | null,
  body?: unknown,
) {
  const headers = new Headers();
  if (role) headers.set("cookie", cookies[role]);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const ctx = (id: number | string) => ({
  params: Promise.resolve({ id: String(id) }),
});

async function queue(role: Role | null = "sewing_supervisor", query = "") {
  const response = await queueRoute(
    request(`/api/sewing/queue${query}`, "GET", role),
    undefined,
  );
  return { status: response.status, body: await response.json() };
}
const queuedIds = async (query = "") =>
  ((await queue("sewing_supervisor", query)).body.batches as SewingBatch[]).map(
    (batch) => batch.id,
  );
const start = (role: Role | null, id: number | string, body?: unknown) =>
  startRoute(
    request(`/api/sewing/queue/${id}/start`, "POST", role, body),
    ctx(id),
  );

// Builds an order through the real endpoints and stops at the given status.
async function orderIn(
  status:
    "CUTTING_IN_PROGRESS" | "PENDING_VERIFICATION" | "REJECTED" | "VERIFIED",
  offsets: Record<string, number> = {},
) {
  const created = await createOrder(
    request("/api/orders", "POST", "cutting_supervisor", {
      recipeId: blouseId,
      targetQty: 50,
      fabricRollId: "FAB-ROLL-882",
      actualFabricYds: 94.5,
    }),
    undefined,
  );
  const order: OrderSummary = (await created.json()).order;
  if (status === "CUTTING_IN_PROGRESS") return order;

  await submitOrder(
    request(`/api/orders/${order.id}/submit`, "POST", "cutting_supervisor"),
    ctx(order.id),
  );
  if (status === "PENDING_VERIFICATION") return order;

  const short = status === "REJECTED" ? { "Sleeve Cuffs": -4 } : offsets;
  const counts = order.items.map((item) => ({
    componentId: item.componentId,
    actualQty:
      item.expectedQty +
      ((short as Record<string, number>)[item.componentName] ?? 0),
  }));
  await putCounts(
    request(
      `/api/verification/orders/${order.id}/counts`,
      "PUT",
      "cutting_verifier",
      { counts },
    ),
    ctx(order.id),
  );
  const decide = status === "REJECTED" ? rejectRoute : approveRoute;
  const body =
    status === "REJECTED" ? { note: "Sleeve cuffs short by 4" } : undefined;
  const decided = await decide(
    request(
      `/api/verification/orders/${order.id}/decide`,
      "POST",
      "cutting_verifier",
      body,
    ),
    ctx(order.id),
  );
  expect(decided.status).toBe(200);
  return order;
}

beforeAll(async () => {
  db = await createTestDb();
  [{ id: blouseId }] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(eq(recipes.recipeCode, "REC-BL01"));
  for (const account of DEMO_ACCOUNTS) {
    const response = await login(
      request("/api/auth/login", "POST", null, account),
      undefined,
    );
    cookies[account.role] = response.headers.get("set-cookie")!.split(";")[0];
    [{ id: userIds[account.role] }] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, account.email));
  }
});

describe("GET /api/sewing/queue", () => {
  it("Test 5: never returns an order that is not VERIFIED", async () => {
    const cutting = await orderIn("CUTTING_IN_PROGRESS");
    const pending = await orderIn("PENDING_VERIFICATION");
    const rejected = await orderIn("REJECTED");
    const verified = await orderIn("VERIFIED");

    const ids = await queuedIds();
    expect(ids).toContain(verified.id);
    for (const hidden of [cutting, pending, rejected])
      expect(ids).not.toContain(hidden.id);

    // Cross-check against the table itself: the queue is exactly the VERIFIED rows.
    const verifiedRows = await db
      .select({ id: cuttingOrders.id })
      .from(cuttingOrders)
      .where(eq(cuttingOrders.status, "VERIFIED"));
    expect(ids.sort()).toEqual(verifiedRows.map((row) => row.id).sort());
  });

  it.each([
    "?status=PENDING_VERIFICATION",
    "?status=REJECTED&status=CUTTING_IN_PROGRESS",
    "?status=",
    "?all=true&includeUnverified=1",
    "?filter[status]=PENDING_VERIFICATION",
    "?where=1%3D1",
    "?status=VERIFIED'%20OR%20'1'='1",
  ])("is not widened by the query string %s", async (query) => {
    const pending = await orderIn("PENDING_VERIFICATION");
    const rejected = await orderIn("REJECTED");
    expect(await queuedIds(query)).toEqual(await queuedIds());
    expect(await queuedIds(query)).not.toContain(pending.id);
    expect(await queuedIds(query)).not.toContain(rejected.id);
  });

  it("shows a batch as soon as the verifier approves it, with its audit record", async () => {
    const order = await orderIn("PENDING_VERIFICATION");
    expect(await queuedIds()).not.toContain(order.id);

    const counts = order.items.map((item) => ({
      componentId: item.componentId,
      actualQty:
        item.expectedQty + (item.componentName === "Collar & Stand" ? 3 : 0),
    }));
    await putCounts(
      request(
        `/api/verification/orders/${order.id}/counts`,
        "PUT",
        "cutting_verifier",
        { counts },
      ),
      ctx(order.id),
    );
    await approveRoute(
      request(
        `/api/verification/orders/${order.id}/approve`,
        "POST",
        "cutting_verifier",
      ),
      ctx(order.id),
    );

    const batch = ((await queue()).body.batches as SewingBatch[]).find(
      (candidate) => candidate.id === order.id,
    )!;
    expect(batch).toMatchObject({
      orderNo: order.orderNo,
      targetQty: 50,
      fabricRollId: "FAB-ROLL-882",
      expectedFabricYds: 90,
      approval: { verifierName: "Demo Cutting Verifier", wastagePct: 5 },
      rejections: [],
      sewing: null,
    });
    expect(Date.now() - new Date(batch.approval!.at).getTime()).toBeLessThan(
      60_000,
    );
    expect(
      batch.items.find((item) => item.componentName === "Collar & Stand"),
    ).toMatchObject({ expectedQty: 50, actualQty: 53, status: "YELLOW" });
    expect(
      batch.items.every(
        (item) => item.status === "GREEN" || item.status === "YELLOW",
      ),
    ).toBe(true);
  });

  it("carries earlier rejection notes into the queue once the re-cut is approved", async () => {
    const order = await orderIn("REJECTED");
    await submitOrder(
      request(`/api/orders/${order.id}/submit`, "POST", "cutting_supervisor"),
      ctx(order.id),
    );
    const counts = order.items.map((item) => ({
      componentId: item.componentId,
      actualQty: item.expectedQty,
    }));
    await putCounts(
      request(
        `/api/verification/orders/${order.id}/counts`,
        "PUT",
        "cutting_verifier",
        { counts },
      ),
      ctx(order.id),
    );
    await approveRoute(
      request(
        `/api/verification/orders/${order.id}/approve`,
        "POST",
        "cutting_verifier",
      ),
      ctx(order.id),
    );

    const batch = ((await queue()).body.batches as SewingBatch[]).find(
      (candidate) => candidate.id === order.id,
    )!;
    expect(batch.rejections).toMatchObject([
      {
        note: "Sleeve cuffs short by 4",
        verifierName: "Demo Cutting Verifier",
      },
    ]);
  });

  it.each(["cutting_supervisor", "cutting_verifier"] as const)(
    "returns 403 for %s and leaks no batch data",
    async (role) => {
      await orderIn("VERIFIED");
      const { status, body } = await queue(role);
      expect(status).toBe(403);
      expect(JSON.stringify(body)).not.toMatch(/CO-|batches/);
    },
  );

  it("returns 401 without a session", async () => {
    expect((await queue(null)).status).toBe(401);
  });
});

describe("POST /api/sewing/queue/:id/start", () => {
  const rowOf = async (id: number) =>
    (await db.select().from(cuttingOrders).where(eq(cuttingOrders.id, id)))[0];

  it("records who started sewing and when, from the session", async () => {
    const order = await orderIn("VERIFIED");
    const response = await start("sewing_supervisor", order.id, {
      startedBy: userIds.cutting_verifier,
      sewingStartedAt: "2000-01-01T00:00:00Z",
    });
    expect(response.status).toBe(200);

    const row = await rowOf(order.id);
    expect(row.status).toBe("VERIFIED");
    expect(row.sewingStartedBy).toBe(userIds.sewing_supervisor);
    expect(Date.now() - row.sewingStartedAt!.getTime()).toBeLessThan(60_000);

    const batch = ((await queue()).body.batches as SewingBatch[]).find(
      (candidate) => candidate.id === order.id,
    )!;
    expect(batch.sewing).toMatchObject({
      startedByName: "Demo Sewing Supervisor",
    });
  });

  it("can only be started once, even for simultaneous requests", async () => {
    const order = await orderIn("VERIFIED");
    const statuses = (
      await Promise.all([
        start("sewing_supervisor", order.id),
        start("sewing_supervisor", order.id),
      ])
    ).map((r) => r.status);
    expect(statuses.sort()).toEqual([200, 409]);
    expect((await start("sewing_supervisor", order.id)).status).toBe(409);
  });

  it.each(["CUTTING_IN_PROGRESS", "PENDING_VERIFICATION", "REJECTED"] as const)(
    "answers 404 for a %s order, exactly as for one that does not exist",
    async (status) => {
      const order = await orderIn(status);
      const hidden = await start("sewing_supervisor", order.id);
      const missing = await start("sewing_supervisor", 999_999);
      expect(hidden.status).toBe(404);
      expect(await hidden.json()).toEqual(await missing.json());
      expect((await rowOf(order.id)).sewingStartedAt).toBeNull();
    },
  );

  it.each(["cutting_supervisor", "cutting_verifier"] as const)(
    "returns 403 for %s",
    async (role) => {
      const order = await orderIn("VERIFIED");
      expect((await start(role, order.id)).status).toBe(403);
      expect((await rowOf(order.id)).sewingStartedAt).toBeNull();
    },
  );

  it("returns 401 without a session and 404 for a malformed id", async () => {
    const order = await orderIn("VERIFIED");
    expect((await start(null, order.id)).status).toBe(401);
    expect((await start("sewing_supervisor", "1 OR 1=1")).status).toBe(404);
  });
});

describe("POST /api/sewing/queue/:id/complete", () => {
  const complete = (role: Role | null, id: number | string, body?: unknown) =>
    completeRoute(
      request(`/api/sewing/queue/${id}/complete`, "POST", role, body),
      ctx(id),
    );
  const rowOf = async (id: number) =>
    (await db.select().from(cuttingOrders).where(eq(cuttingOrders.id, id)))[0];
  const batchOf = async (id: number) =>
    ((await queue()).body.batches as SewingBatch[]).find(
      (candidate) => candidate.id === id,
    )!;

  it("records who completed sewing and when, from the session", async () => {
    const order = await orderIn("VERIFIED");
    await start("sewing_supervisor", order.id);
    const response = await complete("sewing_supervisor", order.id, {
      completedBy: userIds.cutting_verifier,
      sewingCompletedAt: "2000-01-01T00:00:00Z",
    });
    expect(response.status).toBe(200);

    const row = await rowOf(order.id);
    expect(row.status).toBe("VERIFIED");
    expect(row.sewingCompletedBy).toBe(userIds.sewing_supervisor);
    expect(row.sewingCompletedAt!.getTime()).toBeGreaterThanOrEqual(
      row.sewingStartedAt!.getTime(),
    );
    expect(Date.now() - row.sewingCompletedAt!.getTime()).toBeLessThan(60_000);

    // Still in the queue query, now with its completion record.
    expect((await batchOf(order.id)).completion).toMatchObject({
      completedByName: "Demo Sewing Supervisor",
    });
  });

  it("refuses to complete a batch that has not been started", async () => {
    const order = await orderIn("VERIFIED");
    const response = await complete("sewing_supervisor", order.id);
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("NOT_STARTED");
    expect((await rowOf(order.id)).sewingCompletedAt).toBeNull();
    expect((await batchOf(order.id)).completion).toBeNull();
  });

  it("can only be completed once, even for simultaneous requests", async () => {
    const order = await orderIn("VERIFIED");
    await start("sewing_supervisor", order.id);
    const statuses = (
      await Promise.all([
        complete("sewing_supervisor", order.id),
        complete("sewing_supervisor", order.id),
      ])
    ).map((response) => response.status);
    expect(statuses.sort()).toEqual([200, 409]);

    const again = await complete("sewing_supervisor", order.id);
    expect(again.status).toBe(409);
    expect((await again.json()).error.code).toBe("ALREADY_COMPLETED");
  });

  it.each(["CUTTING_IN_PROGRESS", "PENDING_VERIFICATION", "REJECTED"] as const)(
    "answers 404 for a %s order, exactly as for one that does not exist",
    async (status) => {
      const order = await orderIn(status);
      const hidden = await complete("sewing_supervisor", order.id);
      const missing = await complete("sewing_supervisor", 999_999);
      expect(hidden.status).toBe(404);
      expect(await hidden.json()).toEqual(await missing.json());
    },
  );

  it.each(["cutting_supervisor", "cutting_verifier"] as const)(
    "returns 403 for %s",
    async (role) => {
      const order = await orderIn("VERIFIED");
      await start("sewing_supervisor", order.id);
      expect((await complete(role, order.id)).status).toBe(403);
      expect((await rowOf(order.id)).sewingCompletedAt).toBeNull();
    },
  );

  it("returns 401 without a session", async () => {
    const order = await orderIn("VERIFIED");
    await start("sewing_supervisor", order.id);
    expect((await complete(null, order.id)).status).toBe(401);
  });
});

// Direct writes that bypass the API.
describe("sewing start database rules", () => {
  async function rejectionMessage(
    query: PromiseLike<unknown>,
  ): Promise<string> {
    try {
      await query;
    } catch (error) {
      return String((error as { cause?: unknown }).cause ?? error);
    }
    return "the query was not rejected";
  }
  const markStarted = (
    id: number,
    by: number | null = userIds.sewing_supervisor,
  ) =>
    db
      .update(cuttingOrders)
      .set({ sewingStartedAt: new Date(), sewingStartedBy: by })
      .where(eq(cuttingOrders.id, id));

  it.each(["CUTTING_IN_PROGRESS", "PENDING_VERIFICATION", "REJECTED"] as const)(
    "refuses to mark a %s order as started",
    async (status) => {
      const order = await orderIn(status);
      expect(await rejectionMessage(markStarted(order.id))).toMatch(
        /cutting_orders_sewing_requires_verified/,
      );
    },
  );

  it("refuses a start with no user recorded", async () => {
    const order = await orderIn("VERIFIED");
    expect(await rejectionMessage(markStarted(order.id, null))).toMatch(
      /cutting_orders_sewing_start_attributed/,
    );
  });

  it("makes the start record permanent and keeps the batch frozen", async () => {
    const order = await orderIn("VERIFIED");
    await start("sewing_supervisor", order.id);
    const row = eq(cuttingOrders.id, order.id);

    expect(
      await rejectionMessage(
        db
          .update(cuttingOrders)
          .set({ sewingStartedBy: userIds.cutting_supervisor })
          .where(row),
      ),
    ).toMatch(/start record cannot be changed/);
    expect(
      await rejectionMessage(
        db
          .update(cuttingOrders)
          .set({ sewingStartedAt: null, sewingStartedBy: null })
          .where(row),
      ),
    ).toMatch(/start record cannot be changed/);
    expect(
      await rejectionMessage(
        db
          .update(cuttingOrders)
          .set({ status: "PENDING_VERIFICATION" })
          .where(row),
      ),
    ).toMatch(/cannot move/);
    expect(
      await rejectionMessage(
        db
          .update(verificationItems)
          .set({ actualQty: sql`0`, status: "RED" })
          .where(eq(verificationItems.orderId, order.id)),
      ),
    ).toMatch(/immutable/);
  });

  it("refuses a completion on a batch that was never started", async () => {
    const order = await orderIn("VERIFIED");
    const write = db
      .update(cuttingOrders)
      .set({
        sewingCompletedAt: new Date(),
        sewingCompletedBy: userIds.sewing_supervisor,
      })
      .where(eq(cuttingOrders.id, order.id));
    expect(await rejectionMessage(write)).toMatch(
      /cutting_orders_sewing_completed_after_start/,
    );
  });

  it("refuses a completion with no user recorded, and makes a completion permanent", async () => {
    const order = await orderIn("VERIFIED");
    await start("sewing_supervisor", order.id);
    const row = eq(cuttingOrders.id, order.id);

    expect(
      await rejectionMessage(
        db
          .update(cuttingOrders)
          .set({ sewingCompletedAt: new Date() })
          .where(row),
      ),
    ).toMatch(/cutting_orders_sewing_completion_attributed/);

    await completeRoute(
      request(
        `/api/sewing/queue/${order.id}/complete`,
        "POST",
        "sewing_supervisor",
      ),
      ctx(order.id),
    );
    expect(
      await rejectionMessage(
        db
          .update(cuttingOrders)
          .set({ sewingCompletedAt: null, sewingCompletedBy: null })
          .where(row),
      ),
    ).toMatch(/completion record cannot be changed/);
    expect(
      await rejectionMessage(
        db
          .update(cuttingOrders)
          .set({ sewingCompletedBy: userIds.cutting_supervisor })
          .where(row),
      ),
    ).toMatch(/completion record cannot be changed/);
  });
});
