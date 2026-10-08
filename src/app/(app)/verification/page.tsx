import { requirePageRole } from "@/server/auth/page-session";
import { getDb } from "@/server/db/client";
import { listOrders } from "@/server/orders/service";
import { getVerifierOverview } from "@/server/verification/service";
import { viewFromParam } from "./verifier-views";
import { VerifierWorkspace } from "./verifier-workspace";

export default async function VerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const session = await requirePageRole("cutting_verifier");
  const db = getDb();
  const [pending, overview, { view }] = await Promise.all([
    listOrders(db, { status: "PENDING_VERIFICATION", oldestFirst: true }),
    // The history is this verifier's own: the id comes from the session.
    getVerifierOverview(db, session.userId),
    searchParams,
  ]);

  // The view in the URL only chooses which card opens first.
  return (
    <VerifierWorkspace
      pending={pending}
      overview={overview}
      initialView={viewFromParam(view)}
    />
  );
}
