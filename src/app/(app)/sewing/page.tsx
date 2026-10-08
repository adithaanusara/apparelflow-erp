import { requirePageRole } from "@/server/auth/page-session";
import { getDb } from "@/server/db/client";
import { listSewingQueue } from "@/server/sewing/service";
import { viewFromParam } from "./sewing-views";
import { SewingWorkspace } from "./sewing-workspace";

export default async function SewingPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  await requirePageRole("sewing_supervisor");
  const [batches, { view }] = await Promise.all([
    // Verified batches only: the filter is fixed inside listSewingQueue.
    listSewingQueue(getDb()),
    searchParams,
  ]);

  // The view in the URL only chooses which card opens first.
  return (
    <SewingWorkspace batches={batches} initialView={viewFromParam(view)} />
  );
}
