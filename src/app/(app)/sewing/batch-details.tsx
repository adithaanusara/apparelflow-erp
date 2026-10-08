"use client";

import { useRef } from "react";
import { TrafficLight } from "@/components/traffic-light";
import { secondaryButtonClass } from "@/components/ui";
import { formatDateTime } from "@/lib/format-date";
import type { SewingBatch } from "@/server/sewing/service";

const quantityFormat = new Intl.NumberFormat("en-US");

// The "View Details" button on a batch card and the dialog it opens: the
// verified piece counts, the sign-off, and any earlier rejections.
export function BatchDetails({ batch }: { batch: SewingBatch }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = `batch-${batch.id}-details`;

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-label={`View details for batch ${batch.orderNo}`}
        className={secondaryButtonClass}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="size-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2.5 10s2.8-5 7.5-5 7.5 5 7.5 5-2.8 5-7.5 5-7.5-5-7.5-5Z" />
          <circle cx="10" cy="10" r="2.2" />
        </svg>
        View Details
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100%-1.5rem)] max-w-3xl rounded-2xl bg-white p-0 text-slate-900 shadow-[0_24px_64px_-16px_rgb(2_6_23/0.45)] ring-1 ring-slate-900/10 backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm"
      >
        <div className="p-5 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.16em] text-blue-800 uppercase">
                Verified batch
              </p>
              <h2
                id={titleId}
                className="mt-1.5 text-xl font-bold tracking-tight text-slate-900"
              >
                <span className="font-mono">{batch.orderNo}</span>{" "}
                <span className="font-normal text-slate-500">·</span>{" "}
                {batch.recipe.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close"
              className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-700 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-700"
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

          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl bg-slate-50 p-4 text-sm ring-1 ring-slate-900/[0.05] sm:grid-cols-3">
            <Detail label="Recipe" value={batch.recipe.recipeCode} mono />
            <Detail
              label="Quantity"
              value={`${quantityFormat.format(batch.targetQty)} units`}
            />
            <Detail label="Fabric roll" value={batch.fabricRollId} mono />
            <Detail
              label="Fabric used"
              value={`${quantityFormat.format(batch.actualFabricYds)} of ${quantityFormat.format(batch.expectedFabricYds)} yd`}
            />
            <Detail
              label={`Fabric wastage (cap ${batch.recipe.wastageCap}%)`}
              value={batch.approval ? `${batch.approval.wastagePct}%` : "—"}
            />
            <Detail
              label="Verified by"
              value={batch.approval?.verifierName ?? "No sign-off record"}
            />
            <Detail
              label="Verified"
              value={batch.approval ? formatDateTime(batch.approval.at) : "—"}
            />
            {batch.sewing && (
              <Detail
                label="Sewing started"
                value={`${formatDateTime(batch.sewing.at)} by ${batch.sewing.startedByName}`}
              />
            )}
            {batch.completion && (
              <Detail
                label="Completed"
                value={`${formatDateTime(batch.completion.at)} by ${batch.completion.completedByName}`}
              />
            )}
          </dl>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-900">
              <caption className="pb-2 text-left text-sm font-semibold text-slate-900">
                Verified piece counts
              </caption>
              <thead>
                <tr className="border-b border-slate-300 text-[11px] font-semibold tracking-wide text-slate-600 uppercase sm:text-xs sm:tracking-wider">
                  <th scope="col" className="py-2 pr-1.5 sm:pr-3">
                    Component
                  </th>
                  <th
                    scope="col"
                    className="hidden px-3 py-2 text-right sm:table-cell"
                  >
                    Expected
                  </th>
                  <th scope="col" className="px-1.5 py-2 text-right sm:px-3">
                    Counted
                  </th>
                  <th scope="col" className="py-2 pl-1.5 sm:pl-3">
                    Result
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {batch.items.map((item) => (
                  <tr key={item.componentId}>
                    <th scope="row" className="py-2 pr-1.5 font-normal sm:pr-3">
                      {item.componentName}
                    </th>
                    <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">
                      {quantityFormat.format(item.expectedQty)}
                    </td>
                    <td className="px-1.5 py-2 text-right font-medium tabular-nums sm:px-3">
                      {item.actualQty === null
                        ? "—"
                        : quantityFormat.format(item.actualQty)}
                      {/* On a phone the expected count sits here, since its
                          own column is hidden. */}
                      <span className="font-normal text-slate-600 sm:hidden">
                        {" "}
                        / {quantityFormat.format(item.expectedQty)}
                      </span>
                    </td>
                    <td className="py-2 pl-1.5 sm:pl-3">
                      <TrafficLight
                        expectedQty={item.expectedQty}
                        actualQty={item.actualQty}
                        status={item.status}
                        compact
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 text-sm">
            <h3 className="font-semibold text-slate-900">
              Verifier audit notes
            </h3>
            {batch.rejections.length === 0 ? (
              <p className="mt-1 text-slate-700">
                Approved on the first verification. No rejections recorded.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {batch.rejections.map((rejection) => (
                  <li
                    key={rejection.at}
                    className="rounded-xl bg-amber-50 px-4 py-3 text-amber-950 ring-1 ring-amber-700/30"
                  >
                    <span className="font-semibold">
                      Rejected by {rejection.verifierName} on{" "}
                      {formatDateTime(rejection.at)}, then re-cut and approved:
                    </span>{" "}
                    {rejection.note}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}

function Detail({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-slate-600">{label}</dt>
      <dd
        className={`font-medium text-slate-900 ${mono ? "font-mono text-[13px] break-all" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
