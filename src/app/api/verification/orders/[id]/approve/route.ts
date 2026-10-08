import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth/guards";
import { getDb } from "@/server/db/client";
import { parseIdParam, route } from "@/server/http";
import { approveOrder } from "@/server/verification/service";

// The request body is never read: the decision is made from the counts in
// the database and the verifier is the signed-in user.
export const POST = route(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireRole(request, "cutting_verifier");
    const orderId = parseIdParam((await params).id, "Cutting order");
    const order = await approveOrder(getDb(), orderId, session.userId);
    return NextResponse.json({ order });
  },
);
