import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth/guards";
import { route } from "@/server/http";

export const GET = route(async (request) => {
  return NextResponse.json({ user: await requireSession(request) });
});
