"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { dangerButtonClass, secondaryButtonClass } from "@/components/ui";
import { sendJson } from "@/lib/api-client";

// Deleting takes two clicks: the first only reveals the confirmation.
export function DeleteOrderButton({
  orderId,
  orderNo,
}: {
  orderId: number;
  orderNo: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteOrder() {
    setPending(true);
    setError(null);
    const result = await sendJson("DELETE", `/api/orders/${orderId}`);
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      setConfirming(false);
    }
    // Refresh either way: on a conflict the list is showing a stale status.
    router.refresh();
  }

  if (!confirming) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Delete order ${orderNo}`}
          className={secondaryButtonClass}
        >
          Delete
        </button>
        {error && (
          <p role="alert" className="mt-1 text-sm font-medium text-red-800">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={`Confirm deleting order ${orderNo}`}
      className="flex flex-wrap items-center gap-2 rounded-md border border-red-700 bg-red-50 px-3 py-2"
    >
      <p className="text-sm font-semibold text-red-950">
        Delete {orderNo} permanently?
      </p>
      <button
        type="button"
        onClick={deleteOrder}
        disabled={pending}
        className={dangerButtonClass}
      >
        {pending ? "Deleting…" : "Yes, delete"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={pending}
        className={secondaryButtonClass}
      >
        Keep order
      </button>
    </div>
  );
}
