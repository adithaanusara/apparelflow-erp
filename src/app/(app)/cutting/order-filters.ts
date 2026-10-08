import type { OrderStatus } from "@/lib/order-rules";

// The status filters above the order table. "Approved" is the order status
// VERIFIED: an order becomes verified when the Cutting Verifier approves it.
export type OrderFilter = "all" | OrderStatus;

export const ORDER_FILTERS: {
  key: OrderFilter;
  // The value used in the page URL, e.g. /cutting?status=rejected.
  param: string;
  label: string;
}[] = [
  { key: "all", param: "all", label: "All orders" },
  { key: "CUTTING_IN_PROGRESS", param: "in-progress", label: "In progress" },
  { key: "PENDING_VERIFICATION", param: "pending", label: "Pending" },
  { key: "VERIFIED", param: "approved", label: "Approved" },
  { key: "REJECTED", param: "rejected", label: "Rejected" },
];

// Anything unrecognised falls back to showing every order.
export function filterFromParam(param: unknown): OrderFilter {
  return ORDER_FILTERS.find((filter) => filter.param === param)?.key ?? "all";
}
