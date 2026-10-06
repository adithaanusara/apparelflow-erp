"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { primaryButtonClass } from "@/components/ui";
import { postJson } from "@/lib/api-client";

export function StartSewingButton({
  orderId,
  orderNo,
}: {
  orderId: number;
  orderNo: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPending(true);
    setError(null);
    const result = await postJson(`/api/sewing/queue/${orderId}/start`);
    setPending(false);
    if (!result.ok) setError(result.error.message);
    // Refresh either way: on a conflict the queue is showing a stale state.
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={pending}
        aria-label={`Start Sewing Assembly for batch ${orderNo}`}
        className={primaryButtonClass}
      >
        {pending ? "Starting…" : "Start Sewing Assembly"}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-sm font-medium text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
