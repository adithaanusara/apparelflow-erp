export const ORDER_STATUSES = [
  "CUTTING_IN_PROGRESS",
  "PENDING_VERIFICATION",
  "REJECTED",
  "VERIFIED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  CUTTING_IN_PROGRESS: "Cutting in progress",
  PENDING_VERIFICATION: "Pending verification",
  REJECTED: "Rejected",
  VERIFIED: "Verified",
};

// The only legal moves in the manufacturing state machine. VERIFIED is
// terminal: a signed-off batch can never be reopened.
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  CUTTING_IN_PROGRESS: ["PENDING_VERIFICATION"],
  PENDING_VERIFICATION: ["VERIFIED", "REJECTED"],
  REJECTED: ["PENDING_VERIFICATION"],
  VERIFIED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function statusesThatCanBecome(to: OrderStatus): OrderStatus[] {
  return ORDER_STATUSES.filter((from) => canTransition(from, to));
}

function roundTo2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Multiplier engine: 50 garments x 2 cuffs per garment = 100 cut cuffs.
export function expectedComponentQty(
  targetQty: number,
  piecesPerGarment: number,
): number {
  return targetQty * piecesPerGarment;
}

// Works in hundredths of a yard so 1.1 yd x 3 is 3.3, not 3.3000000000000003.
export function expectedFabricYards(
  targetQty: number,
  stdFabricYards: number,
): number {
  return (Math.round(stdFabricYards * 100) * targetQty) / 100;
}

// Fabric Wastage % = (Actual - Expected) / Expected x 100. Negative means the
// batch used less fabric than the recipe standard.
export function wastagePct(
  actualFabricYds: number,
  expectedFabricYds: number,
): number {
  return roundTo2(
    ((actualFabricYds - expectedFabricYds) / expectedFabricYds) * 100,
  );
}

// What the supervisor may still correct. Shared by the UI (which buttons and
// fields to offer) and enforced independently by the order service.
export function canEditOrder(status: OrderStatus): boolean {
  return status === "CUTTING_IN_PROGRESS" || status === "REJECTED";
}

export function canDeleteOrder(status: OrderStatus): boolean {
  return status === "CUTTING_IN_PROGRESS";
}

export function formatOrderNo(orderId: number): string {
  return `CO-${String(orderId).padStart(6, "0")}`;
}
