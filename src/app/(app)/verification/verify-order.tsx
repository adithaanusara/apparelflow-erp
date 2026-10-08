"use client";

import { useRef } from "react";
import { primaryButtonClass } from "@/components/ui";
import type { OrderSummary } from "@/server/orders/service";
import { VerificationCard } from "./verification-card";

// The "Verify" button on a pending batch and the workspace it opens: the
// count sheet with its traffic lights, and the approve and reject actions.
// When the batch is approved or rejected it leaves the pending list, which
// removes this component and closes the dialog with it.
export function VerifyOrder({ order }: { order: OrderSummary }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-label={`Verify order ${order.orderNo}`}
        className={`group ${primaryButtonClass}`}
      >
        Verify
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="size-4 transition-transform duration-200 ease-out motion-safe:group-hover:translate-x-0.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 10h11m-4-4.5 4.5 4.5-4.5 4.5" />
        </svg>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`order-${order.id}-title`}
        className="m-auto w-[calc(100%-1.5rem)] max-w-3xl rounded-2xl bg-white p-0 text-slate-900 shadow-[0_24px_64px_-16px_rgb(2_6_23/0.45)] ring-1 ring-slate-900/10 backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-center justify-between px-5 pt-5 sm:px-8 sm:pt-6">
          <p className="text-xs font-semibold tracking-[0.16em] text-blue-800 uppercase">
            Verify batch
          </p>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
            className="grid size-9 place-items-center rounded-lg text-slate-700 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-700"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="m5.5 5.5 9 9m0-9-9 9" />
            </svg>
          </button>
        </div>
        <VerificationCard order={order} />
      </dialog>
    </>
  );
}
