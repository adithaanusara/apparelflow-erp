import { requirePageRole } from "@/server/auth/page-session";
import { getDb } from "@/server/db/client";
import { listOrders } from "@/server/orders/service";
import { VerificationCard } from "./verification-card";

export default async function VerificationPage() {
  await requirePageRole("cutting_verifier");
  const orders = await listOrders(getDb(), {
    status: "PENDING_VERIFICATION",
    oldestFirst: true,
  });

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">
        Verification Terminal
      </h1>
      <p className="mt-1 max-w-prose text-slate-700">
        Count the cut pieces for every component. A batch can be approved only
        when no component is short; otherwise reject it with a reason.
      </p>

      {orders.length === 0 ? (
        <p className="mt-8 rounded-lg border border-slate-300 bg-white p-6 text-slate-700">
          No batches are waiting for verification.
        </p>
      ) : (
        <ul className="mt-6 space-y-6">
          {orders.map((order) => (
            <li key={order.id}>
              <VerificationCard order={order} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
