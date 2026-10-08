import { NextResponse } from "next/server";
import { validateCreateOrder } from "@/lib/order-input";
import { requireRole } from "@/server/auth/guards";
import { getDb } from "@/server/db/client";
import { HttpError, readJsonObject, route } from "@/server/http";
import { createOrder, listOrders } from "@/server/orders/service";

export const GET = route(async (request) => {
  await requireRole(request, "cutting_supervisor");
  return NextResponse.json({ orders: await listOrders(getDb()) });
});

export const POST = route(async (request) => {
  const session = await requireRole(request, "cutting_supervisor");

  const input = validateCreateOrder(await readJsonObject(request));
  if (!input.ok) {
    throw new HttpError(
      422,
      "VALIDATION_FAILED",
      "The order is invalid.",
      input.errors,
    );
  }

  // The creator is taken from the session, never from the request body.
  const order = await createOrder(getDb(), input.value, session.userId);
  return NextResponse.json({ order }, { status: 201 });
});
