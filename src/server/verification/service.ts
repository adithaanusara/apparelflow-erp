import { and, count, desc, eq } from "drizzle-orm";
import { expectedComponentQty } from "../../lib/order-rules";
import {
  approvalBlockers,
  checkActualQty,
  checkRejectionNote,
  itemStatusFor,
} from "../../lib/verification-rules";
import type { Database } from "../db/client";
import {
  cuttingOrders,
  recipeComponents,
  users,
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

// The session says who is signing; this confirms they may still sign. A
// session outlives a role change by up to its lifetime, and a decision is
// the one write that must not be made on a stale role.
async function requireCurrentVerifier(tx: Database, userId: number) {
  const [user] = await tx
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) {
    throw new HttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
  }
  if (user.role !== "cutting_verifier") {
    throw new HttpError(
      403,
      "FORBIDDEN",
      "Your role is not allowed to perform this action.",
    );
  }
}

type ChecklistBlocker = { componentId: number; name: string; reason: string };

// Compares the order's checklist with its recipe. A batch is only complete
// when every recipe component is on the checklist with the quantity the batch
// size requires, so a component that is missing from the checklist blocks
// approval exactly as a shortage does.
async function checklistBlockers(
  tx: Database,
  order: OrderSummary,
): Promise<ChecklistBlocker[]> {
  const components = await tx
    .select({
      id: recipeComponents.id,
      name: recipeComponents.componentName,
      piecesPerGarment: recipeComponents.piecesPerGarment,
    })
    .from(recipeComponents)
    .where(eq(recipeComponents.recipeId, order.recipe.id));
  const itemByComponent = new Map(
    order.items.map((item) => [item.componentId, item]),
  );

  const blockers: ChecklistBlocker[] = [];
  for (const { id, name, piecesPerGarment } of components) {
    const item = itemByComponent.get(id);
    const required = expectedComponentQty(order.targetQty, piecesPerGarment);
    if (!item) {
      blockers.push({
        componentId: id,
        name,
        reason: "Missing from the checklist.",
      });
    } else if (item.expectedQty !== required) {
      blockers.push({
        componentId: id,
        name,
        reason: `The checklist expects ${item.expectedQty}, but the recipe requires ${required}.`,
      });
    }
  }

  const inRecipe = new Set(components.map((component) => component.id));
  for (const item of order.items) {
    if (!inRecipe.has(item.componentId)) {
      blockers.push({
        componentId: item.componentId,
        name: item.componentName,
        reason: "Not a component of this order's recipe.",
      });
    }
  }
  return blockers;
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
// same transaction that writes the result: if any component is missing,
// uncounted or short the request ends with 422 and nothing changes. On
// success the audit log and the status change are written together or not at
// all.
export async function approveOrder(
  db: Database,
  orderId: number,
  verifierId: number,
): Promise<OrderSummary> {
  return db.transaction(async (tx) => {
    await requireCurrentVerifier(tx, verifierId);
    await lockPendingOrder(tx, orderId);
    const order = await loadSummary(tx, orderId);

    const mismatches = await checklistBlockers(tx, order);
    const blockers = approvalBlockers(order.items);
    if (
      order.items.length === 0 ||
      mismatches.length > 0 ||
      blockers.length > 0
    ) {
      const nameOf = new Map(
        order.items.map((item) => [item.componentId, item.componentName]),
      );
      throw new HttpError(
        422,
        "APPROVAL_BLOCKED",
        order.items.length === 0
          ? "Approval blocked: this order has no components to verify."
          : mismatches.length > 0
            ? "Approval blocked: the checklist for this order does not match its recipe."
            : `Approval blocked: ${blockers.length} of ${order.items.length} components are short or not counted.`,
        // A checklist problem is listed last so it is the reason shown for a
        // component that is also short or uncounted.
        Object.fromEntries([
          ...blockers.map(({ componentId, reason }) => [
            componentId,
            `${nameOf.get(componentId)}: ${reason}`,
          ]),
          ...mismatches.map(({ componentId, name, reason }) => [
            componentId,
            `${name}: ${reason}`,
          ]),
        ]),
      );
    }

    // The decision is recorded while the order is still at the QC station and
    // the status moves in the same transaction; the database refuses either
    // one without the other.
    await tx.insert(verificationLogs).values({
      orderId,
      verifierId,
      decision: "APPROVED",
      wastagePct: order.wastagePct,
    });
    await tx
      .update(cuttingOrders)
      .set({ status: "VERIFIED", updatedAt: new Date() })
      .where(eq(cuttingOrders.id, orderId));

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
    await requireCurrentVerifier(tx, verifierId);
    await lockPendingOrder(tx, orderId);
    const order = await loadSummary(tx, orderId);

    await tx.insert(verificationLogs).values({
      orderId,
      verifierId,
      decision: "REJECTED",
      rejectionNote: (note as string).trim(),
      wastagePct: order.wastagePct,
    });
    await tx
      .update(cuttingOrders)
      .set({ status: "REJECTED", updatedAt: new Date() })
      .where(eq(cuttingOrders.id, orderId));

    return loadSummary(tx, orderId);
  });
}

export type VerificationDecision = {
  id: number;
  orderNo: string;
  recipeName: string;
  recipeCode: string;
  // The Cutting Supervisor who created the order.
  supervisorName: string;
  targetQty: number;
  decision: "APPROVED" | "REJECTED";
  rejectionNote: string | null;
  wastagePct: number;
  at: string;
};

export type VerifierOverview = {
  // Batches waiting at the QC station, whoever ends up verifying them.
  pending: number;
  // This verifier's own decisions: totals, and the most recent of each kind.
  approved: number;
  rejected: number;
  history: {
    approved: VerificationDecision[];
    rejected: VerificationDecision[];
  };
};

const HISTORY_LIMIT = 25;

// The verifier's workspace summary. Decisions are read from the append-only
// audit log and limited to `verifierId`, which the caller takes from the
// session: a verifier sees their own sign-offs, not another verifier's.
export async function getVerifierOverview(
  db: Database,
  verifierId: number,
): Promise<VerifierOverview> {
  const ownDecisions = eq(verificationLogs.verifierId, verifierId);
  const latest = (decision: "APPROVED" | "REJECTED") =>
    db.query.verificationLogs.findMany({
      where: and(ownDecisions, eq(verificationLogs.decision, decision)),
      orderBy: desc(verificationLogs.id),
      limit: HISTORY_LIMIT,
      with: {
        order: {
          with: {
            recipe: { columns: { name: true, recipeCode: true } },
            creator: { columns: { fullName: true } },
          },
        },
      },
    });

  const [pending, totals, approved, rejected] = await Promise.all([
    db.$count(cuttingOrders, eq(cuttingOrders.status, "PENDING_VERIFICATION")),
    db
      .select({ decision: verificationLogs.decision, total: count() })
      .from(verificationLogs)
      .where(ownDecisions)
      .groupBy(verificationLogs.decision),
    latest("APPROVED"),
    latest("REJECTED"),
  ]);

  const totalOf = (decision: "APPROVED" | "REJECTED") =>
    totals.find((row) => row.decision === decision)?.total ?? 0;
  const toDecision = (
    log: Awaited<ReturnType<typeof latest>>[number],
  ): VerificationDecision => ({
    id: log.id,
    orderNo: log.order.orderNo,
    recipeName: log.order.recipe.name,
    recipeCode: log.order.recipe.recipeCode,
    supervisorName: log.order.creator.fullName,
    targetQty: log.order.targetQty,
    decision: log.decision,
    rejectionNote: log.rejectionNote,
    wastagePct: log.wastagePct,
    at: log.timestamp.toISOString(),
  });

  return {
    pending,
    approved: totalOf("APPROVED"),
    rejected: totalOf("REJECTED"),
    history: {
      approved: approved.map(toDecision),
      rejected: rejected.map(toDecision),
    },
  };
}
