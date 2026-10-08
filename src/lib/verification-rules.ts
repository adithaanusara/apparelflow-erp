export const ITEM_STATUSES = ["GREEN", "YELLOW", "RED"] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const ACTUAL_QTY_MAX = 10_000_000;
export const REJECTION_NOTE_MAX_LENGTH = 500;

// Traffic-light matrix: an exact match is GREEN, a surplus is YELLOW and a
// shortage is RED.
export function itemStatusFor(
  expectedQty: number,
  actualQty: number,
): ItemStatus {
  if (actualQty < expectedQty) return "RED";
  return actualQty > expectedQty ? "YELLOW" : "GREEN";
}

export function checkActualQty(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Enter a whole number of pieces.";
  }
  if (!Number.isInteger(value)) return "Whole pieces only, no decimals.";
  if (value < 0) return "A count cannot be negative.";
  if (value > ACTUAL_QTY_MAX) {
    return `A count cannot exceed ${ACTUAL_QTY_MAX.toLocaleString("en-US")}.`;
  }
  return null;
}

export function checkRejectionNote(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return "A reason is required to reject a batch.";
  }
  if (value.trim().length > REJECTION_NOTE_MAX_LENGTH) {
    return `The reason cannot exceed ${REJECTION_NOTE_MAX_LENGTH} characters.`;
  }
  return null;
}

export type ApprovalBlocker = { componentId: number; reason: string };

// The hard-stop rule. An order may be approved only when this returns an
// empty list: every component counted, and none short.
export function approvalBlockers(
  items: readonly {
    componentId: number;
    expectedQty: number;
    actualQty: number | null;
  }[],
): ApprovalBlocker[] {
  return items.flatMap((item) => {
    if (item.actualQty === null) {
      return [{ componentId: item.componentId, reason: "Not counted." }];
    }
    if (itemStatusFor(item.expectedQty, item.actualQty) === "RED") {
      return [
        {
          componentId: item.componentId,
          reason: `Short by ${item.expectedQty - item.actualQty} (counted ${item.actualQty} of ${item.expectedQty}).`,
        },
      ];
    }
    return [];
  });
}
