import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth/guards";
import { getDb } from "@/server/db/client";
import { parseIdParam, route } from "@/server/http";
import { submitOrderForVerification } from "@/server/orders/service";

export const POST = route(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    await requireRole(request, "cutting_supervisor");
    const orderId = parseIdParam((await params).id, "Cutting order");
    const order = await submitOrderForVerification(getDb(), orderId);
    return NextResponse.json({ order });
  },
);
