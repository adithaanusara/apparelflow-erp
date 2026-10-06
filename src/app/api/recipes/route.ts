import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth/guards";
import { getDb } from "@/server/db/client";
import { route } from "@/server/http";
import { listRecipes } from "@/server/orders/service";

export const GET = route(async (request) => {
  await requireRole(request, "cutting_supervisor");
  return NextResponse.json({ recipes: await listRecipes(getDb()) });
});
