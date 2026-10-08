import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth/guards";
import { getDb } from "@/server/db/client";
import { route } from "@/server/http";
import { listOrders } from "@/server/orders/service";

// The verifier's queue. The status filter is fixed here and is not
// influenced by anything in the request.
export const GET = route(async (request) => {
  await requireRole(request, "cutting_verifier");
  const orders = await listOrders(getDb(), {
    status: "PENDING_VERIFICATION",
    oldestFirst: true,
  });
  return NextResponse.json({ orders });
});
