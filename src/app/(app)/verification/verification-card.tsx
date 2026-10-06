"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TrafficLight } from "@/components/traffic-light";
import {
  fieldErrorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { postJson, sendJson } from "@/lib/api-client";
import { numberFromText } from "@/lib/order-input";
import {
  REJECTION_NOTE_MAX_LENGTH,
  checkActualQty,
  checkRejectionNote,
  itemStatusFor,
} from "@/lib/verification-rules";
import type { OrderSummary } from "@/server/orders/service";

type Action = "save" | "approve" | "reject";

const quantityFormat = new Intl.NumberFormat("en-US");

// Column template shared by the header and every component row.
const ROW_GRID = "sm:grid-cols-[minmax(0,1fr)_6rem_9rem_13rem]";

export function VerificationCard({ order }: { order: OrderSummary }) {
  const router = useRouter();
  const [countText, setCountText] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      order.items.map((item) => [
        item.componentId,
        item.actualQty === null ? "" : String(item.actualQty),
      ]),
    ),
  );
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [notice, setNotice] = useState<{
    kind: "error" | "success";
    text: string;
    details?: string[];
  } | null>(null);

  // The traffic lights are recomputed from the typed text on every render
  // with the same rule the server applies when the counts are saved.
  const rows = order.items.map((item) => {
    const text = countText[item.componentId] ?? "";
    const blank = text.trim() === "";
    const value = numberFromText(text);
    const error = blank ? null : checkActualQty(value);
    const actualQty = !blank && error === null ? (value as number) : null;
    const status =
      actualQty === null ? null : itemStatusFor(item.expectedQty, actualQty);
    return { item, text, error, actualQty, status };
  });

  const invalidCount = rows.filter((row) => row.error).length;
  const uncountedCount = rows.filter((row) => row.actualQty === null).length;
  const shortCount = rows.filter((row) => row.status === "RED").length;
  const canApprove =
    invalidCount === 0 && uncountedCount === 0 && shortCount === 0;

  const approveHint =
    invalidCount > 0
      ? "Fix the highlighted counts before continuing."
      : shortCount > 0
        ? `Approval is blocked: ${shortCount} component${shortCount === 1 ? " is" : "s are"} short. Reject the batch with a reason.`
        : uncountedCount > 0
          ? `Approval is blocked until the remaining ${uncountedCount} component${uncountedCount === 1 ? " is" : "s are"} counted.`
          : "Every component matches or exceeds the expected count.";

  const formId = `order-${order.id}`;

  async function saveCounts(): Promise<boolean> {
    if (invalidCount > 0) {
      setNotice({ kind: "error", text: "Fix the highlighted counts first." });
      return false;
    }
    const result = await sendJson(
      "PUT",
      `/api/verification/orders/${order.id}/counts`,
      {
        counts: rows.map((row) => ({
          componentId: row.item.componentId,
          actualQty: row.actualQty,
        })),
      },
    );
    if (!result.ok) {
      setNotice({
        kind: "error",
        text: result.error.message,
        details: Object.values(result.error.fieldErrors ?? {}),
      });
      if (result.error.status === 409) router.refresh();
    }
    return result.ok;
  }

  async function run(action: Action) {
    setNotice(null);
    setNoteError(null);
    if (action === "reject") {
      const error = checkRejectionNote(note);
      if (error) {
        setNoteError(error);
        return;
      }
    }

    setBusy(action);
    // Counts are stored first so the decision is made on what the verifier
    // sees, and a rejection keeps the counts that explain it.
    if (await saveCounts()) {
      if (action === "save") {
        setNotice({ kind: "success", text: "Counts saved." });
      } else {
        const result = await postJson(
          `/api/verification/orders/${order.id}/${action}`,
          action === "reject" ? { note } : undefined,
        );
        if (!result.ok) {
          setNotice({
            kind: "error",
            text: result.error.message,
            details: Object.values(result.error.fieldErrors ?? {}),
          });
        }
      }
      router.refresh();
    }
    setBusy(null);
  }

  return (
    <article
      aria-labelledby={`${formId}-title`}
      className="rounded-lg border border-slate-300 bg-white p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id={`${formId}-title`}
            className="font-mono text-lg font-bold text-slate-900"
          >
            {order.orderNo}
          </h2>
          <p className="text-slate-900">
            {order.recipe.recipeCode} — {order.recipe.name},{" "}
            {quantityFormat.format(order.targetQty)} garments
          </p>
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-3 text-sm">
          <dt className="text-slate-700">Fabric roll</dt>
          <dd className="font-mono font-semibold text-slate-900">
            {order.fabricRollId}
          </dd>
          <dt className="text-slate-700">Fabric wastage</dt>
          <dd className="font-semibold text-slate-900 tabular-nums">
            {order.wastagePct}% (cap {order.recipe.wastageCap}%)
          </dd>
        </dl>
      </div>

      {order.latestRejection && (
        <p className="mt-4 rounded-md border border-amber-700 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <span className="font-semibold">
            Re-cut batch. Previously rejected by{" "}
            {order.latestRejection.verifierName}:
          </span>{" "}
          {order.latestRejection.note}
        </p>
      )}

      {/* Four columns on wide screens; on a phone each component becomes two
          lines (name and expected, then count and status) so nothing is cut
          off or needs sideways scrolling. */}
      <div className="mt-4 text-sm text-slate-900">
        <div
          aria-hidden="true"
          className={`hidden gap-x-4 border-b border-slate-400 pb-2 font-semibold sm:grid ${ROW_GRID}`}
        >
          <span>Component</span>
          <span className="text-right">Expected</span>
          <span>Counted</span>
          <span>Status</span>
        </div>
        <ul>
          {rows.map(({ item, text, error, actualQty, status }) => {
            const inputId = `${formId}-count-${item.componentId}`;
            return (
              <li
                key={item.componentId}
                className={`grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 border-b border-slate-200 py-3 sm:py-2 ${ROW_GRID}`}
              >
                <label
                  htmlFor={inputId}
                  className="font-semibold sm:font-normal"
                >
                  {item.componentName}
                </label>
                <p className="text-right font-semibold tabular-nums">
                  <span className="font-normal text-slate-700 sm:sr-only">
                    Expected{" "}
                  </span>
                  {quantityFormat.format(item.expectedQty)}
                </p>
                <div>
                  <input
                    id={inputId}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Count"
                    value={text}
                    onChange={(event) =>
                      setCountText((current) => ({
                        ...current,
                        [item.componentId]: event.target.value,
                      }))
                    }
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${inputId}-error` : undefined}
                    className={`max-w-36 tabular-nums ${inputClass}`}
                  />
                  {error && (
                    <p id={`${inputId}-error`} className={fieldErrorClass}>
                      {error}
                    </p>
                  )}
                </div>
                <div
                  aria-live="polite"
                  className="justify-self-end sm:justify-self-start"
                >
                  <TrafficLight
                    expectedQty={item.expectedQty}
                    actualQty={actualQty}
                    status={status}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <p
        id={`${formId}-approve-hint`}
        aria-live="polite"
        className={`mt-4 text-sm font-semibold ${canApprove ? "text-green-900" : "text-red-800"}`}
      >
        {approveHint}
      </p>

      <div className="mt-4">
        <label htmlFor={`${formId}-note`} className={labelClass}>
          Rejection reason (required to reject)
        </label>
        <textarea
          id={`${formId}-note`}
          rows={2}
          maxLength={REJECTION_NOTE_MAX_LENGTH}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            setNoteError(null);
          }}
          placeholder="e.g. Sleeve cuffs short by 4 pieces"
          aria-invalid={Boolean(noteError)}
          aria-describedby={noteError ? `${formId}-note-error` : undefined}
          className={`mt-1 ${inputClass}`}
        />
        {noteError && (
          <p id={`${formId}-note-error`} className={fieldErrorClass}>
            {noteError}
          </p>
        )}
      </div>

      {notice && (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          className={`mt-4 rounded-md border px-3 py-2 text-sm font-medium ${
            notice.kind === "error"
              ? "border-red-700 bg-red-50 text-red-900"
              : "border-green-700 bg-green-50 text-green-950"
          }`}
        >
          <p>{notice.text}</p>
          {notice.details && notice.details.length > 0 && (
            <ul className="mt-1 list-disc pl-5 font-normal">
              {notice.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={() => run("save")}
          disabled={busy !== null}
          className={secondaryButtonClass}
        >
          {busy === "save" ? "Saving…" : "Save counts"}
        </button>
        <button
          type="button"
          onClick={() => run("reject")}
          disabled={busy !== null}
          className="inline-flex items-center justify-center rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700"
        >
          {busy === "reject" ? "Rejecting…" : "Reject Batch"}
        </button>
        <button
          type="button"
          onClick={() => run("approve")}
          disabled={!canApprove || busy !== null}
          aria-describedby={`${formId}-approve-hint`}
          className={primaryButtonClass}
        >
          {busy === "approve" ? "Approving…" : "Approve Batch"}
        </button>
      </div>
    </article>
  );
}
