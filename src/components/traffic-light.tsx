import type { ItemStatus } from "@/lib/verification-rules";

const STYLES: Record<ItemStatus | "UNCOUNTED", { badge: string; dot: string }> =
  {
    GREEN: {
      badge: "border-green-700 bg-green-100 text-green-950",
      dot: "bg-green-700",
    },
    YELLOW: {
      badge: "border-yellow-600 bg-yellow-100 text-yellow-950",
      dot: "bg-yellow-500",
    },
    RED: { badge: "border-red-700 bg-red-100 text-red-950", dot: "bg-red-700" },
    UNCOUNTED: {
      badge: "border-slate-500 bg-white text-slate-800",
      dot: "bg-slate-400",
    },
  };

// The status is always written out in words next to the colour, so it does
// not depend on colour vision. `compact` drops the detail ("Match",
// "Short by 4") on narrow screens, for tables where the expected and counted
// numbers are already in the neighbouring columns.
export function TrafficLight({
  expectedQty,
  actualQty,
  status,
  compact = false,
}: {
  expectedQty: number;
  actualQty: number | null;
  status: ItemStatus | null;
  compact?: boolean;
}) {
  const difference = actualQty === null ? 0 : actualQty - expectedQty;
  const detail =
    status === "GREEN"
      ? "Match"
      : status === "YELLOW"
        ? `Excess +${difference}`
        : status === "RED"
          ? `Short by ${-difference}`
          : null;
  const style = STYLES[status ?? "UNCOUNTED"];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border py-1 text-sm font-semibold whitespace-nowrap ${compact ? "px-2 sm:px-3" : "px-3"} ${style.badge}`}
    >
      <span
        aria-hidden="true"
        className={`size-2.5 rounded-full ${style.dot}`}
      />
      <span>
        {status ?? "Not counted"}
        {detail && (
          <span className={compact ? "hidden sm:inline" : undefined}>
            {" · "}
            {detail}
          </span>
        )}
      </span>
    </span>
  );
}
