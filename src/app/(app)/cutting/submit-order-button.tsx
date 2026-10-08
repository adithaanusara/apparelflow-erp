"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { primaryButtonClass } from "@/components/ui";
import { postJson } from "@/lib/api-client";

export function SubmitOrderButton({
  orderId,
  orderNo,
  label,
}: {
  orderId: number;
  orderNo: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    const result = await postJson(`/api/orders/${orderId}/submit`);
    setPending(false);
    if (!result.ok) setError(result.error.message);
    // Refresh either way: on a conflict the list is showing a stale status.
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        aria-label={`${label} order ${orderNo} for verification`}
        className={primaryButtonClass}
      >
        {pending ? "Submitting…" : label}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-sm font-medium text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
