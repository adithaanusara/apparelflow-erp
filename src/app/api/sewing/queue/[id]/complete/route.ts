import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth/guards";
import { getDb } from "@/server/db/client";
import { parseIdParam, route } from "@/server/http";
import { completeSewing } from "@/server/sewing/service";

export const POST = route(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireRole(request, "sewing_supervisor");
    const orderId = parseIdParam((await params).id, "Batch");
    await completeSewing(getDb(), orderId, session.userId);
    return NextResponse.json({ ok: true });
  },
);
