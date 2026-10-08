"use client";

import { useState } from "react";
import { SearchBox } from "@/components/search-box";
import { StatCard } from "@/components/stat-card";
import { secondaryButtonClass, surfaceClass } from "@/components/ui";
import { formatDateTime } from "@/lib/format-date";
import { matchesOrderSearch } from "@/lib/order-search";
import type { SewingBatch } from "@/server/sewing/service";
import { BatchDetails } from "./batch-details";
import { SewingActionButton } from "./sewing-action-button";
import { viewOf, type SewingView } from "./sewing-views";

const quantityFormat = new Intl.NumberFormat("en-US");

const VIEWS: Record<
  SewingView,
  { title: string; empty: string; badge: string; dot: string; chip: string }
> = {
  queue: {
    title: "Ready for sewing",
    empty:
      "No verified batches are waiting. A batch appears here as soon as a Cutting Verifier approves it.",
    chip: "Ready",
    badge: "bg-blue-50 text-blue-800 ring-blue-700/25",
    dot: "bg-blue-600",
  },
  sewing: {
    title: "In sewing",
    empty:
      "Nothing is on the sewing floor. Start a batch from the queue to see it here.",
    chip: "In sewing",
    badge: "bg-amber-50 text-amber-900 ring-amber-600/35",
    dot: "bg-amber-500",
  },
  completed: {
    title: "Completed",
    empty:
      "No batches have been completed yet. Finished batches are kept here with their full record.",
    chip: "Completed",
    badge: "bg-green-50 text-green-800 ring-green-600/30",
    dot: "bg-green-600",
  },
};

// The summary cards double as tabs: each one switches which batches are
// listed below. Every batch on this page has been verified.
export function SewingWorkspace({
  batches,
  initialView,
}: {
  batches: SewingBatch[];
  initialView: SewingView;
}) {
  const [view, setView] = useState(initialView);
  const [search, setSearch] = useState("");

  function choose(next: SewingView) {
    setView(next);
    // Keeps the choice in the address bar, so a reload opens the same view,
    // without asking the server for the page again.
    window.history.replaceState(
      null,
      "",
      next === "queue" ? window.location.pathname : `?view=${next}`,
    );
  }

  const inView = (target: SewingView) =>
    batches.filter((batch) => viewOf(batch) === target);
  // Waiting batches are listed oldest first; work in hand and finished work
  // most recent first.
  const listed =
    view === "queue"
      ? inView("queue")
      : inView(view).sort((a, b) =>
          lastEventOf(b).localeCompare(lastEventOf(a)),
        );
  // The search filters the view that is open, and keeps its text when the
  // view changes.
  const shown = listed.filter((batch) =>
    matchesOrderSearch(search, batch.orderNo, [
      batch.recipe.name,
      batch.recipe.recipeCode,
      batch.approval?.verifierName ?? "",
      batch.fabricRollId,
    ]),
  );
  const query = search.trim();

  return (
    <>
      <p className="text-xs font-semibold tracking-[0.16em] text-blue-800 uppercase">
        Assembly floor
      </p>
      <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-slate-900">
        Sewing Queue
      </h1>
      <p className="mt-1.5 max-w-prose text-slate-700">
        Only batches verified and signed off by a Cutting Verifier appear here.
      </p>

      <section aria-label="Choose a view" className="mt-8">
        <ul className="grid gap-4 sm:grid-cols-3">
          <li>
            <StatCard
              label="In Queue"
              value={inView("queue").length}
              hint="Verified and ready to start"
              tint="bg-blue-50 text-blue-800 ring-blue-700/15"
              active={view === "queue"}
              onSelect={() => choose("queue")}
            >
              <path d="M4 6.5 10 3.5l6 3-6 3-6-3Z" />
              <path d="m4 10 6 3 6-3M4 13.5l6 3 6-3" />
            </StatCard>
          </li>
          <li>
            <StatCard
              label="In Sewing"
              value={inView("sewing").length}
              hint="On the assembly floor now"
              tint="bg-amber-50 text-amber-800 ring-amber-600/20"
              active={view === "sewing"}
              onSelect={() => choose("sewing")}
            >
              <circle cx="10" cy="10" r="6.5" />
              <path d="M8.5 7.4v5.2l4-2.6-4-2.6Z" />
            </StatCard>
          </li>
          <li>
            <StatCard
              label="Completed"
              value={inView("completed").length}
              hint="Sewing finished"
              tint="bg-green-50 text-green-800 ring-green-600/20"
              active={view === "completed"}
              onSelect={() => choose("completed")}
            >
              <circle cx="10" cy="10" r="6.5" />
              <path d="m7.2 10.2 2 2 3.6-4.2" />
            </StatCard>
          </li>
        </ul>
      </section>

      <section aria-labelledby="view-heading" className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h2
              id="view-heading"
              className="text-lg font-bold tracking-tight text-slate-900"
            >
              {VIEWS[view].title}
            </h2>
            <p aria-live="polite" className="text-sm text-slate-700">
              {listed.length === 0
                ? "Nothing here yet"
                : query !== ""
                  ? `${quantityFormat.format(shown.length)} of ${quantityFormat.format(listed.length)} match “${query}”`
                  : `${quantityFormat.format(listed.length)} ${listed.length === 1 ? "batch" : "batches"} · ${view === "queue" ? "oldest first" : "most recent first"}`}
            </p>
          </div>

          {/* Search: filters the cards in view as you type. */}
          <SearchBox
            id="sewing-search"
            value={search}
            onChange={setSearch}
            label={`Search ${VIEWS[view].title.toLowerCase()} by order number, product or verifier`}
            placeholder="Search order no., product or verifier"
          />
        </div>

        {/* Keyed on the view so each switch replays the short entry motion. */}
        <div key={view} className="mt-4 motion-safe:animate-reveal">
          {listed.length === 0 ? (
            <p className={`p-10 text-center text-slate-700 ${surfaceClass}`}>
              {VIEWS[view].empty}
            </p>
          ) : shown.length === 0 ? (
            <div className={`p-10 text-center ${surfaceClass}`}>
              <p className="text-slate-700">
                Nothing in this view matches “{query}”.
              </p>
              <button
                type="button"
                onClick={() => setSearch("")}
                className={`mt-4 ${secondaryButtonClass}`}
              >
                Clear search
              </button>
            </div>
          ) : (
            // Two across on wide screens. A batch with no neighbour (the only
            // one, or the last of an odd number) takes the full width, so a
            // card never sits beside an empty half.
            <ul className="grid gap-5 xl:grid-cols-2">
              {shown.map((batch, index) => {
                const alone =
                  index === shown.length - 1 && shown.length % 2 === 1;
                return (
                  <li key={batch.id} className={alone ? "xl:col-span-2" : ""}>
                    <BatchCard batch={batch} view={view} wide={alone} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}

// The moment a batch last moved on: completed, else started, else verified.
function lastEventOf(batch: SewingBatch): string {
  return batch.completion?.at ?? batch.sewing?.at ?? batch.approval?.at ?? "";
}

function BatchCard({
  batch,
  view,
  wide,
}: {
  batch: SewingBatch;
  view: SewingView;
  wide: boolean;
}) {
  const style = VIEWS[view];
  const wastage = batch.approval?.wastagePct;
  const overCap = wastage !== undefined && wastage > batch.recipe.wastageCap;

  return (
    <article
      aria-labelledby={`batch-${batch.id}`}
      className={`flex h-full flex-col p-6 sm:p-7 ${surfaceClass}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 id={`batch-${batch.id}`} className="min-w-0">
          <span className="block font-mono text-sm font-semibold tracking-wide text-blue-800">
            {batch.orderNo}
          </span>
          <span className="mt-0.5 block text-xl font-bold tracking-tight text-slate-900">
            {batch.recipe.name}
          </span>
        </h3>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${style.badge}`}
        >
          <span
            aria-hidden="true"
            className={`size-1.5 rounded-full ${style.dot}`}
          />
          {style.chip}
        </span>
      </div>

      <dl
        className={`mt-5 grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl bg-slate-50 p-4 text-sm ring-1 ring-slate-900/[0.05] md:grid-cols-4 ${wide ? "" : "xl:grid-cols-2"}`}
      >
        <div>
          <dt className="text-xs text-slate-600">Quantity</dt>
          <dd className="mt-0.5 text-base font-semibold text-slate-900 tabular-nums">
            {quantityFormat.format(batch.targetQty)} units
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-600">Fabric wastage</dt>
          <dd
            className={`mt-0.5 text-base font-semibold tabular-nums ${overCap ? "text-red-800" : "text-slate-900"}`}
          >
            {wastage === undefined ? "—" : `${wastage}%`}
            <span
              className={`text-xs font-normal ${overCap ? "" : "text-slate-600"}`}
            >
              {" "}
              ({overCap ? "above" : "within"} {batch.recipe.wastageCap}% cap)
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-600">Verified by</dt>
          <dd className="mt-0.5 font-medium text-slate-900">
            {batch.approval?.verifierName ?? "No sign-off record"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-600">Verified</dt>
          <dd className="mt-0.5 font-medium text-slate-900">
            {batch.approval ? formatDateTime(batch.approval.at) : "—"}
          </dd>
        </div>
      </dl>

      {/* How far sewing has got, once it has begun. */}
      {batch.sewing && (
        <p className="mt-4 text-sm text-slate-700">
          <span className="font-semibold text-slate-900">
            {batch.completion ? "Completed" : "Sewing started"}
          </span>{" "}
          {formatDateTime((batch.completion ?? batch.sewing).at)} by{" "}
          {batch.completion?.completedByName ?? batch.sewing.startedByName}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-start justify-end gap-3 pt-6">
        <BatchDetails batch={batch} />
        {view === "queue" && (
          <SewingActionButton
            orderId={batch.id}
            orderNo={batch.orderNo}
            action="start"
          />
        )}
        {view === "sewing" && (
          <SewingActionButton
            orderId={batch.id}
            orderNo={batch.orderNo}
            action="complete"
          />
        )}
      </div>
    </article>
  );
}
