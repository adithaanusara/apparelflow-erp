import type { SewingBatch } from "@/server/sewing/service";

// The three views of the Sewing workspace, chosen with the summary cards.
// Every batch here is VERIFIED; the view is how far sewing has got.
export type SewingView = "queue" | "sewing" | "completed";

const VIEWS: SewingView[] = ["queue", "sewing", "completed"];

// The value used in the page URL, e.g. /sewing?view=completed. Anything
// unrecognised falls back to the queue.
export function viewFromParam(param: unknown): SewingView {
  return VIEWS.find((view) => view === param) ?? "queue";
}

export function viewOf(batch: SewingBatch): SewingView {
  if (batch.completion) return "completed";
  return batch.sewing ? "sewing" : "queue";
}
