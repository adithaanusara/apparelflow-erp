import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth/guards";
import { getDb } from "@/server/db/client";
import { parseIdParam, readJsonObject, route } from "@/server/http";
import { rejectOrder } from "@/server/verification/service";

export const POST = route(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireRole(request, "cutting_verifier");
    const orderId = parseIdParam((await params).id, "Cutting order");
    const { note } = await readJsonObject(request);
    const order = await rejectOrder(getDb(), orderId, session.userId, note);
    return NextResponse.json({ order });
  },
);
