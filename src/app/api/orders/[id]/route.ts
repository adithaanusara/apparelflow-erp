import { NextResponse } from "next/server";
import { validateCreateOrder } from "@/lib/order-input";
import { requireRole } from "@/server/auth/guards";
import { getDb } from "@/server/db/client";
import { HttpError, parseIdParam, readJsonObject, route } from "@/server/http";
import { deleteOrder, updateOrder } from "@/server/orders/service";

type Context = { params: Promise<{ id: string }> };

// Replaces the editable fields of an order. The body has the same shape and
// goes through the same validator as order creation.
export const PUT = route(async (request, { params }: Context) => {
  await requireRole(request, "cutting_supervisor");
  const orderId = parseIdParam((await params).id, "Cutting order");

  const input = validateCreateOrder(await readJsonObject(request));
  if (!input.ok) {
    throw new HttpError(
      422,
      "VALIDATION_FAILED",
      "The order is invalid.",
      input.errors,
    );
  }

  const order = await updateOrder(getDb(), orderId, input.value);
  return NextResponse.json({ order });
});

export const DELETE = route(async (request, { params }: Context) => {
  await requireRole(request, "cutting_supervisor");
  const orderId = parseIdParam((await params).id, "Cutting order");
  await deleteOrder(getDb(), orderId);
  return new NextResponse(null, { status: 204 });
});
