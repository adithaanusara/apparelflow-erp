import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { expectedFabricYards } from "../../lib/order-rules";
import type { ItemStatus } from "../../lib/verification-rules";
import type { Database } from "../db/client";
import {
  cuttingOrders,
  verificationItems,
  verificationLogs,
} from "../db/schema";
import { HttpError } from "../http";

// A verified batch as the sewing floor sees it: the piece counts, who signed
// it off, and any earlier rejections. Everything here was written by the
// cutting department and is read-only for sewing.
export type SewingBatch = {
  id: number;
  orderNo: string;
  targetQty: number;
  fabricRollId: string;
  actualFabricYds: number;
  expectedFabricYds: number;
  recipe: { recipeCode: string; name: string; wastageCap: number };
  items: {
    componentId: number;
    componentName: string;
    expectedQty: number;
    actualQty: number | null;
    status: ItemStatus | null;
  }[];
  // The approval record written at sign-off. The wastage figure is the one
  // stored then, not a recalculation.
  approval: { verifierName: string; at: string; wastagePct: number } | null;
  // Earlier rejections of this batch, oldest first.
  rejections: { verifierName: string; at: string; note: string }[];
  sewing: { startedByName: string; at: string } | null;
  completion: { completedByName: string; at: string } | null;
};

// The Sewing Queue. `status = 'VERIFIED'` is written into the query here and
// the function takes no filter argument, so no caller, URL parameter or
// request body can widen it to unverified, pending or rejected orders.
export async function listSewingQueue(db: Database): Promise<SewingBatch[]> {
  const orders = await db.query.cuttingOrders.findMany({
    where: eq(cuttingOrders.status, "VERIFIED"),
    orderBy: asc(cuttingOrders.id),
    with: {
      recipe: true,
      sewingStarter: { columns: { fullName: true } },
      sewingCompleter: { columns: { fullName: true } },
      items: {
        orderBy: asc(verificationItems.componentId),
        with: { component: true },
      },
      logs: {
        orderBy: asc(verificationLogs.id),
        with: { verifier: { columns: { fullName: true } } },
      },
    },
  });

  return orders.map((order) => {
    const approval = order.logs.find((log) => log.decision === "APPROVED");
    return {
      id: order.id,
      orderNo: order.orderNo,
      targetQty: order.targetQty,
      fabricRollId: order.fabricRollId,
      actualFabricYds: order.actualFabricYds,
      expectedFabricYds: expectedFabricYards(
        order.targetQty,
        order.recipe.stdFabricYards,
      ),
      recipe: {
        recipeCode: order.recipe.recipeCode,
        name: order.recipe.name,
        wastageCap: order.recipe.wastageCap,
      },
      items: order.items.map((item) => ({
        componentId: item.componentId,
        componentName: item.component.componentName,
        expectedQty: item.expectedQty,
        actualQty: item.actualQty,
        status: item.status,
      })),
      approval: approval
        ? {
            verifierName: approval.verifier.fullName,
            at: approval.timestamp.toISOString(),
            wastagePct: approval.wastagePct,
          }
        : null,
      rejections: order.logs
        .filter((log) => log.decision === "REJECTED")
        .map((log) => ({
          verifierName: log.verifier.fullName,
          at: log.timestamp.toISOString(),
          note: log.rejectionNote ?? "",
        })),
      sewing:
        order.sewingStartedAt && order.sewingStarter
          ? {
              startedByName: order.sewingStarter.fullName,
              at: order.sewingStartedAt.toISOString(),
            }
          : null,
      completion:
        order.sewingCompletedAt && order.sewingCompleter
          ? {
              completedByName: order.sewingCompleter.fullName,
              at: order.sewingCompletedAt.toISOString(),
            }
          : null,
    };
  });
}

// Records "Start Sewing Assembly". The conditions are part of the UPDATE, so
// only a VERIFIED batch can be started and only once. The time comes from
// the database and the user from the session.
export async function startSewing(
  db: Database,
  orderId: number,
  startedBy: number,
): Promise<void> {
  const started = await db
    .update(cuttingOrders)
    .set({ sewingStartedAt: new Date(), sewingStartedBy: startedBy })
    .where(
      and(
        eq(cuttingOrders.id, orderId),
        eq(cuttingOrders.status, "VERIFIED"),
        isNull(cuttingOrders.sewingStartedAt),
      ),
    )
    .returning({ id: cuttingOrders.id });
  if (started.length > 0) return;

  const [verified] = await db
    .select({ id: cuttingOrders.id })
    .from(cuttingOrders)
    .where(
      and(eq(cuttingOrders.id, orderId), eq(cuttingOrders.status, "VERIFIED")),
    );
  // An order that exists but is not verified gets the same 404 as one that
  // does not exist: the sewing floor must not learn anything about it.
  if (!verified) {
    throw new HttpError(
      404,
      "NOT_FOUND",
      "Batch not found in the Sewing Queue.",
    );
  }
  throw new HttpError(
    409,
    "ALREADY_STARTED",
    "Sewing assembly has already been started for this batch.",
  );
}

// Records that sewing is finished. As with the start, the conditions are part
// of the UPDATE: the batch must be VERIFIED, already started and not yet
// completed, so it can be completed only once and never before it began.
export async function completeSewing(
  db: Database,
  orderId: number,
  completedBy: number,
): Promise<void> {
  const completed = await db
    .update(cuttingOrders)
    .set({ sewingCompletedAt: new Date(), sewingCompletedBy: completedBy })
    .where(
      and(
        eq(cuttingOrders.id, orderId),
        eq(cuttingOrders.status, "VERIFIED"),
        isNotNull(cuttingOrders.sewingStartedAt),
        isNull(cuttingOrders.sewingCompletedAt),
      ),
    )
    .returning({ id: cuttingOrders.id });
  if (completed.length > 0) return;

  const [verified] = await db
    .select({
      startedAt: cuttingOrders.sewingStartedAt,
      completedAt: cuttingOrders.sewingCompletedAt,
    })
    .from(cuttingOrders)
    .where(
      and(eq(cuttingOrders.id, orderId), eq(cuttingOrders.status, "VERIFIED")),
    );
  // As in startSewing: an unverified order is indistinguishable from one
  // that does not exist.
  if (!verified) {
    throw new HttpError(
      404,
      "NOT_FOUND",
      "Batch not found in the Sewing Queue.",
    );
  }
  throw new HttpError(
    409,
    verified.completedAt ? "ALREADY_COMPLETED" : "NOT_STARTED",
    verified.completedAt
      ? "This batch has already been marked as completed."
      : "Sewing has not been started for this batch yet.",
  );
}
