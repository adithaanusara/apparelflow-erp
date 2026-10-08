"use client";

import { useState } from "react";
import { SearchBox } from "@/components/search-box";
import { StatCard } from "@/components/stat-card";
import { secondaryButtonClass, surfaceClass } from "@/components/ui";
import { formatDateTime } from "@/lib/format-date";
import { matchesOrderSearch } from "@/lib/order-search";
import type { OrderSummary } from "@/server/orders/service";
import type {
  VerificationDecision,
  VerifierOverview,
} from "@/server/verification/service";
import type { VerifierView } from "./verifier-views";
import { VerifyOrder } from "./verify-order";

const quantityFormat = new Intl.NumberFormat("en-US");
const VIEW_TITLE: Record<VerifierView, string> = {
  pending: "Pending verification",
  approved: "Approved by you",
  rejected: "Rejected by you",
};

// The summary cards double as tabs: each one switches what is shown below.
// The search box filters whichever list is in view, and keeps its text when
// the view changes.
export function VerifierWorkspace({
  pending,
  overview,
  initialView,
}: {
  pending: OrderSummary[];
  overview: VerifierOverview;
  initialView: VerifierView;
}) {
  const [view, setView] = useState(initialView);
  const [search, setSearch] = useState("");

  function choose(next: VerifierView) {
    setView(next);
    // Keeps the choice in the address bar, so a reload opens the same view,
    // without asking the server for the page again.
    window.history.replaceState(
      null,
      "",
      next === "pending" ? window.location.pathname : `?view=${next}`,
    );
  }

  const pendingShown = pending.filter((order) =>
    matchesOrderSearch(search, order.orderNo, [
      order.recipe.name,
      order.recipe.recipeCode,
      order.createdByName,
      order.fabricRollId,
    ]),
  );
  const decisions = view === "pending" ? [] : overview.history[view];
  const decisionsShown = decisions.filter((decision) =>
    matchesOrderSearch(search, decision.orderNo, [
      decision.recipeName,
      decision.recipeCode,
      decision.supervisorName,
    ]),
  );

  const listed = view === "pending" ? pending.length : decisions.length;
  const shown =
    view === "pending" ? pendingShown.length : decisionsShown.length;
  // History lists hold the most recent decisions; the card has the true total.
  const total =
    view === "pending"
      ? pending.length
      : view === "approved"
        ? overview.approved
        : overview.rejected;
  const query = search.trim();

  const summary =
    listed === 0
      ? view === "pending"
        ? "Nothing waiting"
        : "Nothing yet"
      : query !== ""
        ? `${quantityFormat.format(shown)} of ${quantityFormat.format(listed)} match “${query}”`
        : view === "pending"
          ? `${quantityFormat.format(listed)} waiting · oldest first`
          : listed < total
            ? `Latest ${listed} of ${quantityFormat.format(total)} · newest first`
            : `${quantityFormat.format(total)} in total · newest first`;

  return (
    <>
      <p className="text-xs font-semibold tracking-[0.16em] text-blue-800 uppercase">
        Quality control
      </p>
      <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-slate-900">
        Verification Terminal
      </h1>
      <p className="mt-1.5 max-w-prose text-slate-700">
        Count the cut pieces for every component. A batch can be approved only
        when no component is short; otherwise reject it with a reason.
      </p>

      <section aria-label="Choose a view" className="mt-8">
        <ul className="grid gap-4 sm:grid-cols-3">
          <li>
            <StatCard
              label="Pending"
              value={overview.pending}
              hint="Waiting at the QC station"
              tint="bg-amber-50 text-amber-800 ring-amber-600/20"
              active={view === "pending"}
              onSelect={() => choose("pending")}
            >
              <circle cx="10" cy="10" r="6.5" />
              <path d="M10 6.5V10l2.5 1.5" />
            </StatCard>
          </li>
          <li>
            <StatCard
              label="Approved"
              value={overview.approved}
              hint="Signed off by you"
              tint="bg-green-50 text-green-800 ring-green-600/20"
              active={view === "approved"}
              onSelect={() => choose("approved")}
            >
              <circle cx="10" cy="10" r="6.5" />
              <path d="m7.2 10.2 2 2 3.6-4.2" />
            </StatCard>
          </li>
          <li>
            <StatCard
              label="Rejected"
              value={overview.rejected}
              hint="Returned by you for re-cutting"
              tint="bg-red-50 text-red-800 ring-red-600/20"
              active={view === "rejected"}
              onSelect={() => choose("rejected")}
            >
              <circle cx="10" cy="10" r="6.5" />
              <path d="m7.7 7.7 4.6 4.6m0-4.6-4.6 4.6" />
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
              {VIEW_TITLE[view]}
            </h2>
            <p aria-live="polite" className="text-sm text-slate-700">
              {summary}
            </p>
          </div>

          {/* Search: filters the list in view as you type. */}
          <SearchBox
            id="verifier-search"
            value={search}
            onChange={setSearch}
            label={`Search ${VIEW_TITLE[view].toLowerCase()} by order number, product or supervisor`}
            placeholder="Search order no., product or supervisor"
          />
        </div>

        {/* Keyed on the view so each switch replays the short entry motion. */}
        <div key={view} className="mt-4 motion-safe:animate-reveal">
          {listed === 0 ? (
            <Empty>
              {view === "pending"
                ? "No batches are waiting for verification. New ones appear here as soon as a Cutting Supervisor submits them."
                : view === "approved"
                  ? "You have not approved any batches yet. Batches you sign off will be listed here."
                  : "You have not rejected any batches yet. Batches you return for re-cutting will be listed here."}
            </Empty>
          ) : shown === 0 ? (
            <Empty onClear={() => setSearch("")}>
              Nothing in this view matches “{query}”.
            </Empty>
          ) : view === "pending" ? (
            <ul className="grid gap-4">
              {pendingShown.map((order) => (
                <li key={order.id}>
                  <PendingCard order={order} />
                </li>
              ))}
            </ul>
          ) : (
            <DecisionHistory kind={view} decisions={decisionsShown} />
          )}
        </div>
      </section>
    </>
  );
}

function Empty({
  children,
  onClear,
}: {
  children: React.ReactNode;
  onClear?: () => void;
}) {
  return (
    <div className={`p-10 text-center ${surfaceClass}`}>
      <p className="text-slate-700">{children}</p>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className={`mt-4 ${secondaryButtonClass}`}
        >
          Clear search
        </button>
      )}
    </div>
  );
}

// A batch waiting at the QC station, with how far its count has got.
function PendingCard({ order }: { order: OrderSummary }) {
  const counted = order.items.filter((item) => item.actualQty !== null).length;
  const short = order.items.filter((item) => item.status === "RED").length;
  const overCap = order.wastagePct > order.recipe.wastageCap;

  return (
    <article
      aria-labelledby={`pending-${order.id}`}
      className={`w-full p-5 sm:p-6 ${surfaceClass}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id={`pending-${order.id}`}
            className="font-mono text-lg font-semibold text-slate-900"
          >
            {order.orderNo}
          </h3>
          <p className="text-slate-900">
            {order.recipe.name}{" "}
            <span className="font-mono text-xs text-slate-600">
              {order.recipe.recipeCode}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {order.latestRejection && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800 ring-1 ring-slate-500/30">
              Re-cut
            </span>
          )}
          <DecisionBadge tone="pending">Pending</DecisionBadge>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
        <div>
          <dt className="text-xs text-slate-600">Quantity</dt>
          <dd className="font-medium text-slate-900 tabular-nums">
            {quantityFormat.format(order.targetQty)} garments
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-600">Fabric roll</dt>
          <dd className="font-mono text-[13px] font-medium break-all text-slate-900">
            {order.fabricRollId}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-600">Wastage</dt>
          <dd
            className={`font-medium tabular-nums ${overCap ? "text-red-800" : "text-slate-900"}`}
          >
            {order.wastagePct}%
            <span className={`font-normal ${overCap ? "" : "text-slate-600"}`}>
              {" "}
              ({overCap ? "above" : "within"} {order.recipe.wastageCap}% cap)
            </span>
          </dd>
        </div>
        <div className="sm:col-span-2 lg:col-span-1">
          <dt className="text-xs text-slate-600">Supervisor</dt>
          <dd className="font-medium text-slate-900">{order.createdByName}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-600">Submitted</dt>
          <dd className="font-medium text-slate-900">
            {formatDateTime(order.updatedAt)}
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-4">
        <p className="text-sm text-slate-700">
          <span className="font-semibold text-slate-900 tabular-nums">
            {counted} of {order.items.length}
          </span>{" "}
          components counted
          {short > 0 && (
            <span className="font-semibold text-red-800"> · {short} short</span>
          )}
        </p>
        <VerifyOrder order={order} />
      </div>
    </article>
  );
}

// The verifier's own past decisions of one kind, newest first.
function DecisionHistory({
  kind,
  decisions,
}: {
  kind: "approved" | "rejected";
  decisions: VerificationDecision[];
}) {
  const approved = kind === "approved";
  const label = approved ? "Approved" : "Rejected";

  return (
    <div className={`overflow-hidden ${surfaceClass}`}>
      {/* Wide screens: a table. */}
      <table className="hidden w-full text-left text-sm text-slate-900 lg:table">
        <caption className="sr-only">
          {approved ? "Batches you approved" : "Batches you rejected"}
        </caption>
        <thead>
          <tr className="bg-slate-50 text-xs font-semibold tracking-wider text-slate-600 uppercase">
            <th scope="col" className="py-3 pr-4 pl-6">
              Order
            </th>
            <th scope="col" className="px-4 py-3">
              Product
            </th>
            <th scope="col" className="px-4 py-3">
              Supervisor
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Quantity
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Wastage
            </th>
            {!approved && (
              <th scope="col" className="px-4 py-3">
                Reason
              </th>
            )}
            <th scope="col" className="px-4 py-3">
              {label} on
            </th>
            <th scope="col" className="py-3 pr-6 pl-4">
              Decision
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {decisions.map((decision) => (
            <tr
              key={decision.id}
              className="transition-colors duration-150 hover:bg-slate-50/80"
            >
              <th
                scope="row"
                className="py-4 pr-4 pl-6 font-mono text-[15px] font-semibold whitespace-nowrap"
              >
                {decision.orderNo}
              </th>
              <td className="px-4 py-4">
                <span className="block font-medium">{decision.recipeName}</span>
                <span className="block font-mono text-xs text-slate-600">
                  {decision.recipeCode}
                </span>
              </td>
              <td className="px-4 py-4">{decision.supervisorName}</td>
              <td className="px-4 py-4 text-right tabular-nums">
                {quantityFormat.format(decision.targetQty)}
              </td>
              <td className="px-4 py-4 text-right tabular-nums">
                {decision.wastagePct}%
              </td>
              {!approved && (
                <td className="max-w-xs px-4 py-4 text-slate-800">
                  {decision.rejectionNote}
                </td>
              )}
              <td className="px-4 py-4 whitespace-nowrap text-slate-700">
                {formatDateTime(decision.at)}
              </td>
              <td className="py-4 pr-6 pl-4">
                <DecisionBadge tone={kind}>{label}</DecisionBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Narrower screens: the same decisions as stacked entries. */}
      <ol className="divide-y divide-slate-200 lg:hidden">
        {decisions.map((decision) => (
          <li key={decision.id} className="px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[15px] font-semibold text-slate-900">
                  {decision.orderNo}
                </p>
                <p className="text-sm text-slate-700">
                  {decision.recipeName} ·{" "}
                  {quantityFormat.format(decision.targetQty)} garments
                </p>
                <p className="text-sm text-slate-700">
                  Supervisor: {decision.supervisorName}
                </p>
              </div>
              <DecisionBadge tone={kind}>{label}</DecisionBadge>
            </div>
            {decision.rejectionNote && (
              <p className="mt-2 text-sm text-slate-800">
                <span className="font-semibold">Reason:</span>{" "}
                {decision.rejectionNote}
              </p>
            )}
            <p className="mt-1.5 text-xs text-slate-600">
              {formatDateTime(decision.at)} · wastage {decision.wastagePct}%
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

const BADGE_TONES = {
  pending: {
    badge: "bg-amber-50 text-amber-900 ring-amber-600/35",
    dot: "bg-amber-500",
  },
  approved: {
    badge: "bg-green-50 text-green-800 ring-green-600/30",
    dot: "bg-green-600",
  },
  rejected: {
    badge: "bg-red-50 text-red-800 ring-red-600/30",
    dot: "bg-red-600",
  },
};

function DecisionBadge({
  tone,
  children,
}: {
  tone: VerifierView;
  children: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ring-1 ${BADGE_TONES[tone].badge}`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${BADGE_TONES[tone].dot}`}
      />
      {children}
    </span>
  );
}
