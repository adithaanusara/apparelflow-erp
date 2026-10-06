import {
  ORDER_STATUS_LABELS,
  canTransition,
  type OrderStatus,
} from "@/lib/order-rules";
import { requirePageRole } from "@/server/auth/page-session";
import { getDb } from "@/server/db/client";
import { listOrders, listRecipes } from "@/server/orders/service";
import { NewOrderDialog } from "./new-order-dialog";
import { SubmitOrderButton } from "./submit-order-button";

const STATUS_BADGE: Record<OrderStatus, string> = {
  CUTTING_IN_PROGRESS: "border-slate-500 bg-slate-100 text-slate-900",
  PENDING_VERIFICATION: "border-amber-700 bg-amber-100 text-amber-950",
  REJECTED: "border-red-700 bg-red-100 text-red-950",
  VERIFIED: "border-green-700 bg-green-100 text-green-950",
};

const quantityFormat = new Intl.NumberFormat("en-US");
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export default async function CuttingPage() {
  await requirePageRole("cutting_supervisor");
  const db = getDb();
  const [recipes, orders] = await Promise.all([
    listRecipes(db),
    listOrders(db),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cutting orders</h1>
          <p className="mt-1 text-slate-700">
            Create a batch from a recipe, then submit it to the QC station.
          </p>
        </div>
        <NewOrderDialog recipes={recipes} />
      </div>

      {orders.length === 0 ? (
        <p className="mt-8 rounded-lg border border-slate-300 bg-white p-6 text-slate-700">
          No cutting orders yet. Create the first one with “New cutting order”.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {orders.map((order) => {
            const overCap = order.wastagePct > order.recipe.wastageCap;
            return (
              <li
                key={order.id}
                className="rounded-lg border border-slate-300 bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-mono text-lg font-bold text-slate-900">
                      {order.orderNo}
                    </h2>
                    <p className="text-slate-900">
                      {order.recipe.recipeCode} — {order.recipe.name}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-sm font-semibold ${STATUS_BADGE[order.status]}`}
                  >
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-slate-700">Target quantity</dt>
                    <dd className="font-semibold text-slate-900 tabular-nums">
                      {quantityFormat.format(order.targetQty)} garments
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-700">Fabric roll</dt>
                    <dd className="font-mono font-semibold break-all text-slate-900">
                      {order.fabricRollId}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-700">Fabric used / expected</dt>
                    <dd className="font-semibold text-slate-900 tabular-nums">
                      {quantityFormat.format(order.actualFabricYds)} /{" "}
                      {quantityFormat.format(order.expectedFabricYds)} yd
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-700">
                      Wastage (cap {order.recipe.wastageCap}%)
                    </dt>
                    <dd
                      className={`font-semibold tabular-nums ${overCap ? "text-red-800" : "text-slate-900"}`}
                    >
                      {order.wastagePct}%{overCap && " — above cap"}
                    </dd>
                  </div>
                </dl>

                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-semibold text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
                    Expected component counts ({order.items.length})
                  </summary>
                  <table className="mt-2 w-full max-w-xl text-left text-sm text-slate-900">
                    <thead>
                      <tr className="border-b border-slate-400">
                        <th scope="col" className="py-1.5 font-semibold">
                          Component
                        </th>
                        <th
                          scope="col"
                          className="py-1.5 text-right font-semibold"
                        >
                          Per garment
                        </th>
                        <th
                          scope="col"
                          className="py-1.5 text-right font-semibold"
                        >
                          Expected pieces
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item) => (
                        <tr
                          key={item.componentId}
                          className="border-b border-slate-200"
                        >
                          <td className="py-1.5">{item.componentName}</td>
                          <td className="py-1.5 text-right tabular-nums">
                            {item.piecesPerGarment}
                          </td>
                          <td className="py-1.5 text-right font-semibold tabular-nums">
                            {quantityFormat.format(item.expectedQty)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>

                <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                  <p className="text-sm text-slate-700">
                    Created by {order.createdByName} on{" "}
                    {dateFormat.format(new Date(order.createdAt))} UTC
                  </p>
                  {canTransition(order.status, "PENDING_VERIFICATION") && (
                    <SubmitOrderButton
                      orderId={order.id}
                      orderNo={order.orderNo}
                      label={
                        order.status === "REJECTED"
                          ? "Resubmit for verification"
                          : "Submit for verification"
                      }
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
