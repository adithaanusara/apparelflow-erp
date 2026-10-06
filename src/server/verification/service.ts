import { eq } from "drizzle-orm";
import {
  approvalBlockers,
  checkActualQty,
  checkRejectionNote,
  itemStatusFor,
} from "../../lib/verification-rules";
import type { Database } from "../db/client";
import {
  cuttingOrders,
  verificationItems,
  verificationLogs,
} from "../db/schema";
import { HttpError, type FieldErrors } from "../http";
import { findOrderSummary, type OrderSummary } from "../orders/service";

export type CountInput = { componentId: number; actualQty: number | null };

const MAX_COUNTS_PER_REQUEST = 100;

// Parses the body of a save-counts request. A null count clears a component
// back to "not counted". Field errors are keyed by component id.
export function parseCounts(body: Record<string, unknown>): CountInput[] {
  const invalid = (message: string, fieldErrors?: FieldErrors) =>
    new HttpError(422, "VALIDATION_FAILED", message, fieldErrors);

  const { counts } = body;
  if (!Array.isArray(counts) || counts.length === 0) {
    throw invalid("Send the counts as a non-empty array.");
  }
  if (counts.length > MAX_COUNTS_PER_REQUEST) {
    throw invalid("Too many counts in one request.");
  }

  const parsed: CountInput[] = [];
  const fieldErrors: FieldErrors = {};
  const seen = new Set<number>();
  for (const entry of counts) {
    const { componentId, actualQty } = (entry ?? {}) as Record<string, unknown>;
    if (
      typeof componentId !== "number" ||
      !Number.isInteger(componentId) ||
      componentId < 1
    ) {
      throw invalid("Every count needs a valid componentId.");
    }
    if (seen.has(componentId)) {
      throw invalid(`Component ${componentId} is listed more than once.`);
    }
    seen.add(componentId);

    const error = actualQty === null ? null : checkActualQty(actualQty);
    if (error) fieldErrors[componentId] = error;
    else parsed.push({ componentId, actualQty: actualQty as number | null });
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw invalid("One or more counts are invalid.", fieldErrors);
  }
  return parsed;
}

// Locks the order row for the rest of the transaction and insists it is at
// the QC station. Counting, approving and rejecting all start here, so they
// cannot interleave: an approval can never be decided on counts that another
// request is changing at the same moment.
async function lockPendingOrder(tx: Database, orderId: number) {
  const [order] = await tx
    .select({ status: cuttingOrders.status })
    .from(cuttingOrders)
    .where(eq(cuttingOrders.id, orderId))
    .for("update");

  if (!order) {
    throw new HttpError(404, "NOT_FOUND", "Cutting order not found.");
  }
  if (order.status !== "PENDING_VERIFICATION") {
    throw new HttpError(
      409,
      "INVALID_TRANSITION",
      `This order is ${order.status}; only orders pending verification can be counted, approved or rejected.`,
    );
  }
}

async function loadSummary(tx: Database, orderId: number) {
  return (await findOrderSummary(tx, orderId)) as OrderSummary;
}

// Stores the verifier's counts. The traffic-light status is always computed
// here from the stored expected quantity; a status sent by the client is
// never read.
export async function saveCounts(
  db: Database,
  orderId: number,
  counts: CountInput[],
): Promise<OrderSummary> {
  return db.transaction(async (tx) => {
    await lockPendingOrder(tx, orderId);

    const items = await tx
      .select()
      .from(verificationItems)
      .where(eq(verificationItems.orderId, orderId));
    const itemByComponent = new Map(
      items.map((item) => [item.componentId, item]),
    );

    const fieldErrors: FieldErrors = {};
    for (const { componentId } of counts) {
      if (!itemByComponent.has(componentId)) {
        fieldErrors[componentId] = "This component is not part of the order.";
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      throw new HttpError(
        422,
        "VALIDATION_FAILED",
        "One or more counts are invalid.",
        fieldErrors,
      );
    }

    for (const { componentId, actualQty } of counts) {
      const item = itemByComponent.get(componentId)!;
      await tx
        .update(verificationItems)
        .set({
          actualQty,
          status:
            actualQty === null
              ? null
              : itemStatusFor(item.expectedQty, actualQty),
        })
        .where(eq(verificationItems.id, item.id));
    }

    return loadSummary(tx, orderId);
  });
}

// The gatekeeper. Decides from the counts stored in the database, inside the
// same transaction that writes the result: if any component is uncounted or
// short the request ends with 422 and nothing changes. On success the status
// change and the audit log are written together or not at all.
export async function approveOrder(
  db: Database,
  orderId: number,
  verifierId: number,
): Promise<OrderSummary> {
  return db.transaction(async (tx) => {
    await lockPendingOrder(tx, orderId);
    const order = await loadSummary(tx, orderId);

    const blockers = approvalBlockers(order.items);
    if (order.items.length === 0 || blockers.length > 0) {
      const nameOf = new Map(
        order.items.map((item) => [item.componentId, item.componentName]),
      );
      throw new HttpError(
        422,
        "APPROVAL_BLOCKED",
        order.items.length === 0
          ? "Approval blocked: this order has no components to verify."
          : `Approval blocked: ${blockers.length} of ${order.items.length} components are short or not counted.`,
        Object.fromEntries(
          blockers.map(({ componentId, reason }) => [
            componentId,
            `${nameOf.get(componentId)}: ${reason}`,
          ]),
        ),
      );
    }

    await tx
      .update(cuttingOrders)
      .set({ status: "VERIFIED", updatedAt: new Date() })
      .where(eq(cuttingOrders.id, orderId));
    await tx.insert(verificationLogs).values({
      orderId,
      verifierId,
      decision: "APPROVED",
      wastagePct: order.wastagePct,
    });

    return loadSummary(tx, orderId);
  });
}

// Returns the batch to the supervisor with a mandatory reason. The counts are
// left in place as the record of what was wrong; they are cleared when the
// re-cut batch is submitted again.
export async function rejectOrder(
  db: Database,
  orderId: number,
  verifierId: number,
  note: unknown,
): Promise<OrderSummary> {
  const noteError = checkRejectionNote(note);
  if (noteError) {
    throw new HttpError(422, "VALIDATION_FAILED", noteError, {
      note: noteError,
    });
  }

  return db.transaction(async (tx) => {
    await lockPendingOrder(tx, orderId);
    const order = await loadSummary(tx, orderId);

    await tx
      .update(cuttingOrders)
      .set({ status: "REJECTED", updatedAt: new Date() })
      .where(eq(cuttingOrders.id, orderId));
    await tx.insert(verificationLogs).values({
      orderId,
      verifierId,
      decision: "REJECTED",
      rejectionNote: (note as string).trim(),
      wastagePct: order.wastagePct,
    });

    return loadSummary(tx, orderId);
  });
}
