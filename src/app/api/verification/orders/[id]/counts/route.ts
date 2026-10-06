import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth/guards";
import { getDb } from "@/server/db/client";
import { parseIdParam, readJsonObject, route } from "@/server/http";
import { parseCounts, saveCounts } from "@/server/verification/service";

export const PUT = route(
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    await requireRole(request, "cutting_verifier");
    const orderId = parseIdParam((await params).id, "Cutting order");
    const counts = parseCounts(await readJsonObject(request));
    const order = await saveCounts(getDb(), orderId, counts);
    return NextResponse.json({ order });
  },
);
