import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth/guards";
import { getDb } from "@/server/db/client";
import { route } from "@/server/http";
import { getVerifierOverview } from "@/server/verification/service";

// The signed-in verifier's own decisions. Whose history is returned comes
// from the session; nothing in the request can ask for someone else's.
export const GET = route(async (request) => {
  const session = await requireRole(request, "cutting_verifier");
  return NextResponse.json(await getVerifierOverview(getDb(), session.userId));
});
