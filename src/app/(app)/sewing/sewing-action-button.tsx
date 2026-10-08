"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { primaryButtonClass } from "@/components/ui";
import { postJson } from "@/lib/api-client";

const ACTIONS = {
  start: {
    label: "Start Sewing",
    busy: "Starting…",
    describe: (orderNo: string) => `Start sewing assembly for batch ${orderNo}`,
    icon: (
      <path d="M7 5.2v9.6a.6.6 0 0 0 .9.5l8-4.8a.6.6 0 0 0 0-1l-8-4.8a.6.6 0 0 0-.9.5Z" />
    ),
  },
  complete: {
    label: "Mark as Completed",
    busy: "Saving…",
    describe: (orderNo: string) => `Mark batch ${orderNo} as completed`,
    icon: <path d="m4.5 10.5 3.5 3.5 7.5-8" />,
  },
};

// The next step for a batch on the sewing floor. Who did it and when are
// recorded on the server from the session, not sent from here.
export function SewingActionButton({
  orderId,
  orderNo,
  action,
}: {
  orderId: number;
  orderNo: string;
  action: keyof typeof ACTIONS;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { label, busy, describe, icon } = ACTIONS[action];

  async function run() {
    setPending(true);
    setError(null);
    const result = await postJson(`/api/sewing/queue/${orderId}/${action}`);
    setPending(false);
    if (!result.ok) setError(result.error.message);
    // Refresh either way: on a conflict the page is showing a stale state.
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={run}
        disabled={pending}
        aria-label={describe(orderNo)}
        className={primaryButtonClass}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="size-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {icon}
        </svg>
        {pending ? busy : label}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-sm font-medium text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
