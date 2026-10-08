import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth/guards";
import { getDb } from "@/server/db/client";
import { route } from "@/server/http";
import { listSewingQueue } from "@/server/sewing/service";

// Nothing from the request reaches the query: the VERIFIED filter lives in
// listSewingQueue and cannot be changed from here.
export const GET = route(async (request) => {
  await requireRole(request, "sewing_supervisor");
  return NextResponse.json({ batches: await listSewingQueue(getDb()) });
});
