// The three views of the Verifier workspace, chosen with the summary cards.
export type VerifierView = "pending" | "approved" | "rejected";

const VIEWS: VerifierView[] = ["pending", "approved", "rejected"];

// The value used in the page URL, e.g. /verification?view=rejected. Anything
// unrecognised falls back to the pending queue.
export function viewFromParam(param: unknown): VerifierView {
  return VIEWS.find((view) => view === param) ?? "pending";
}
