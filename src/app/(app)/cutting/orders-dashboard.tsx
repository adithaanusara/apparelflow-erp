"use client";

import { useState, type ReactNode } from "react";
import { StatCard } from "@/components/stat-card";
import { TrafficLight } from "@/components/traffic-light";
import {
  inputClass,
  secondaryButtonClass,
  surfaceClass,
} from "@/components/ui";
import {
  canDeleteOrder,
  canEditOrder,
  canTransition,
  type OrderStatus,
} from "@/lib/order-rules";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { matchesOrderSearch } from "@/lib/order-search";
import type {
  OrderSummary,
  RecipeWithComponents,
} from "@/server/orders/service";
import { DeleteOrderButton } from "./delete-order-button";
import { ORDER_FILTERS, type OrderFilter } from "./order-filters";
import { OrderDialog } from "./order-dialog";
import { SubmitOrderButton } from "./submit-order-button";

// How each status is shown. The colour is always paired with the word.
const STATUS: Record<
  OrderStatus,
  { label: string; badge: string; dot: string }
> = {
  CUTTING_IN_PROGRESS: {
    label: "In progress",
    badge: "bg-slate-100 text-slate-800 ring-slate-500/30",
    dot: "bg-slate-500",
  },
  PENDING_VERIFICATION: {
    label: "Pending",
    badge: "bg-amber-50 text-amber-900 ring-amber-600/35",
    dot: "bg-amber-500",
  },
  VERIFIED: {
    label: "Approved",
    badge: "bg-green-50 text-green-800 ring-green-600/30",
    dot: "bg-green-600",
  },
  REJECTED: {
    label: "Rejected",
    badge: "bg-red-50 text-red-800 ring-red-600/30",
    dot: "bg-red-600",
  },
};

type Sort = "newest" | "oldest";

const quantityFormat = new Intl.NumberFormat("en-US");
export function OrdersDashboard({
  orders,
  recipes,
  initialFilter,
}: {
  orders: OrderSummary[];
  recipes: RecipeWithComponents[];
  initialFilter: OrderFilter;
}) {
  const [filter, setFilter] = useState(initialFilter);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());

  const countOf = (key: OrderFilter) =>
    key === "all"
      ? orders.length
      : orders.filter((order) => order.status === key).length;

  const query = search.trim().toLowerCase();
  const visible = orders
    .filter((order) => filter === "all" || order.status === filter)
    .filter((order) =>
      matchesOrderSearch(search, order.orderNo, [
        order.recipe.name,
        order.recipe.recipeCode,
        order.fabricRollId,
        order.createdByName,
      ]),
    )
    .sort((a, b) => (sort === "newest" ? b.id - a.id : a.id - b.id));

  function chooseFilter(next: OrderFilter) {
    setFilter(next);
    // Keeps the choice in the address bar, so a reload or a shared link opens
    // the same view, without asking the server for the page again.
    const param = ORDER_FILTERS.find((option) => option.key === next)?.param;
    window.history.replaceState(
      null,
      "",
      next === "all" ? window.location.pathname : `?status=${param}`,
    );
  }

  function toggle(orderId: number) {
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(orderId)) next.add(orderId);
      return next;
    });
  }

  const activeLabel =
    ORDER_FILTERS.find((option) => option.key === filter)?.label ?? "";

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-blue-800 uppercase">
            Cutting department
          </p>
          <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-slate-900">
            Order dashboard
          </h1>
          <p className="mt-1.5 max-w-prose text-slate-700">
            Create batches from recipes, send them to verification and follow
            every decision.
          </p>
        </div>
        <OrderDialog recipes={recipes} />
      </div>

      {/* Summary cards. Each one also filters the table below. */}
      <section aria-label="Order summary" className="mt-8">
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <li>
            <StatCard
              label="Total orders"
              value={orders.length}
              hint={`${quantityFormat.format(countOf("CUTTING_IN_PROGRESS"))} still being cut`}
              tint="bg-blue-50 text-blue-800 ring-blue-700/15"
              active={filter === "all"}
              onSelect={() => chooseFilter("all")}
            >
              <path d="M4 6.5 10 3.5l6 3-6 3-6-3Z" />
              <path d="m4 10 6 3 6-3M4 13.5l6 3 6-3" />
            </StatCard>
          </li>
          <li>
            <StatCard
              label="Pending verification"
              value={countOf("PENDING_VERIFICATION")}
              hint="Waiting at the QC station"
              tint="bg-amber-50 text-amber-800 ring-amber-600/20"
              active={filter === "PENDING_VERIFICATION"}
              onSelect={() => chooseFilter("PENDING_VERIFICATION")}
            >
              <circle cx="10" cy="10" r="6.5" />
              <path d="M10 6.5V10l2.5 1.5" />
            </StatCard>
          </li>
          <li>
            <StatCard
              label="Approved orders"
              value={countOf("VERIFIED")}
              hint="Released to the Sewing Queue"
              tint="bg-green-50 text-green-800 ring-green-600/20"
              active={filter === "VERIFIED"}
              onSelect={() => chooseFilter("VERIFIED")}
            >
              <circle cx="10" cy="10" r="6.5" />
              <path d="m7.2 10.2 2 2 3.6-4.2" />
            </StatCard>
          </li>
          <li>
            <StatCard
              label="Rejected orders"
              value={countOf("REJECTED")}
              hint="Returned for re-cutting"
              tint="bg-red-50 text-red-800 ring-red-600/20"
              active={filter === "REJECTED"}
              onSelect={() => chooseFilter("REJECTED")}
            >
              <circle cx="10" cy="10" r="6.5" />
              <path d="m7.7 7.7 4.6 4.6m0-4.6-4.6 4.6" />
            </StatCard>
          </li>
        </ul>
      </section>

      <section
        aria-labelledby="orders-heading"
        className={`mt-8 overflow-hidden ${surfaceClass}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 pt-5 sm:px-6">
          <div>
            <h2
              id="orders-heading"
              className="text-lg font-bold tracking-tight text-slate-900"
            >
              Cutting orders
            </h2>
            <p aria-live="polite" className="text-sm text-slate-700">
              Showing {quantityFormat.format(visible.length)} of{" "}
              {quantityFormat.format(orders.length)}
              {filter === "all" ? "" : ` · ${activeLabel}`}
              {query === "" ? "" : ` · matching “${search.trim()}”`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-72 max-w-full">
              <label htmlFor="order-search" className="sr-only">
                Search orders
              </label>
              <input
                id="order-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search order, recipe or supervisor"
                className={`h-10 pl-9 text-sm ${inputClass}`}
              />
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <circle cx="9" cy="9" r="5.2" />
                <path d="m13 13 3.5 3.5" />
              </svg>
            </div>
            <div>
              <label htmlFor="order-sort" className="sr-only">
                Sort orders
              </label>
              <select
                id="order-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as Sort)}
                className={`h-10 w-auto py-0 pr-8 text-sm ${inputClass}`}
              >
                <option value="newest" className="bg-white text-slate-900">
                  Newest first
                </option>
                <option value="oldest" className="bg-white text-slate-900">
                  Oldest first
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* Status filters. */}
        <div className="mt-4 border-b border-slate-200 px-5 pb-4 sm:px-6">
          <div
            role="group"
            aria-label="Filter orders by status"
            className="inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-slate-100 p-1"
          >
            {ORDER_FILTERS.map((option) => {
              const active = option.key === filter;
              return (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => chooseFilter(option.key)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-700 ${
                    active
                      ? "bg-white text-blue-900 shadow-[0_1px_2px_rgb(15_23_42/0.12),0_2px_6px_rgb(15_23_42/0.08)]"
                      : "text-slate-700 hover:bg-white/60 hover:text-slate-900"
                  }`}
                >
                  {option.label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                      active
                        ? "bg-blue-50 text-blue-800"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {quantityFormat.format(countOf(option.key))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            noOrders={orders.length === 0}
            onReset={() => {
              chooseFilter("all");
              setSearch("");
            }}
          />
        ) : (
          <>
            {/* Wide screens: a table. */}
            <table className="hidden w-full text-left text-sm text-slate-900 lg:table">
              <caption className="sr-only">
                Cutting orders{filter === "all" ? "" : `, ${activeLabel}`}
              </caption>
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold tracking-wider text-slate-600 uppercase">
                  <th scope="col" className="py-3 pr-4 pl-6">
                    Order
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Recipe
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Quantity
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Fabric
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Wastage
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                  <th scope="col" className="py-3 pr-6 pl-4 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visible.map((order) => {
                  const open = expanded.has(order.id);
                  const overCap = order.wastagePct > order.recipe.wastageCap;
                  return (
                    <OrderRows key={order.id}>
                      <tr className="transition-colors duration-150 hover:bg-slate-50/80">
                        <th scope="row" className="py-4 pr-4 pl-6 font-normal">
                          <span className="block font-mono text-[15px] font-semibold text-slate-900">
                            {order.orderNo}
                          </span>
                          <span className="block text-xs text-slate-600">
                            {formatDate(order.createdAt)}
                          </span>
                        </th>
                        <td className="px-4 py-4">
                          <span className="block font-medium text-slate-900">
                            {order.recipe.name}
                          </span>
                          <span className="block font-mono text-xs text-slate-600">
                            {order.recipe.recipeCode}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right font-medium tabular-nums">
                          {quantityFormat.format(order.targetQty)}
                        </td>
                        <td className="px-4 py-4">
                          <span className="block font-mono text-[13px] font-medium break-all text-slate-900">
                            {order.fabricRollId}
                          </span>
                          <span className="block text-xs text-slate-600 tabular-nums">
                            {quantityFormat.format(order.actualFabricYds)} of{" "}
                            {quantityFormat.format(order.expectedFabricYds)} yd
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Wastage order={order} overCap={overCap} />
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="py-4 pr-6 pl-4">
                          <div className="flex items-center justify-end gap-2">
                            <PrimaryAction order={order} />
                            <DetailsToggle
                              order={order}
                              open={open}
                              onToggle={() => toggle(order.id)}
                            />
                          </div>
                        </td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={7} className="bg-slate-50/70 px-6 py-5">
                            <OrderDetails order={order} recipes={recipes} />
                          </td>
                        </tr>
                      )}
                    </OrderRows>
                  );
                })}
              </tbody>
            </table>

            {/* Narrow screens: the same orders as stacked cards. */}
            <ul className="divide-y divide-slate-200 lg:hidden">
              {visible.map((order) => {
                const open = expanded.has(order.id);
                const overCap = order.wastagePct > order.recipe.wastageCap;
                return (
                  <li key={order.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-[15px] font-semibold text-slate-900">
                          {order.orderNo}
                        </p>
                        <p className="text-sm text-slate-900">
                          {order.recipe.name}{" "}
                          <span className="font-mono text-xs text-slate-600">
                            {order.recipe.recipeCode}
                          </span>
                        </p>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-slate-600">Quantity</dt>
                        <dd className="font-medium tabular-nums">
                          {quantityFormat.format(order.targetQty)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-600">Fabric roll</dt>
                        <dd className="font-mono text-[13px] font-medium break-all">
                          {order.fabricRollId}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-600">Wastage</dt>
                        <dd>
                          <Wastage order={order} overCap={overCap} />
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <DetailsToggle
                        order={order}
                        open={open}
                        onToggle={() => toggle(order.id)}
                      />
                      <PrimaryAction order={order} />
                    </div>
                    {open && (
                      <div className="mt-4 rounded-xl bg-slate-50 p-4">
                        <OrderDetails order={order} recipes={recipes} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </>
  );
}

// A table body may only contain rows, so each order's row and its optional
// details row are grouped with a fragment.
function OrderRows({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const style = STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ring-1 ${style.badge}`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${style.dot}`}
      />
      {style.label}
    </span>
  );
}

function Wastage({
  order,
  overCap,
}: {
  order: OrderSummary;
  overCap: boolean;
}) {
  return (
    <>
      <span
        className={`block font-medium tabular-nums ${overCap ? "text-red-800" : "text-slate-900"}`}
      >
        {order.wastagePct}%
      </span>
      <span
        className={`block text-xs ${overCap ? "font-semibold text-red-800" : "text-slate-600"}`}
      >
        {overCap ? "Above" : "Within"} {order.recipe.wastageCap}% cap
      </span>
    </>
  );
}

// The next step for an order, when the supervisor has one.
function PrimaryAction({ order }: { order: OrderSummary }) {
  if (!canTransition(order.status, "PENDING_VERIFICATION")) return null;
  return (
    <SubmitOrderButton
      orderId={order.id}
      orderNo={order.orderNo}
      label={order.status === "REJECTED" ? "Resubmit" : "Submit"}
    />
  );
}

function DetailsToggle({
  order,
  open,
  onToggle,
}: {
  order: OrderSummary;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={`${open ? "Hide" : "Show"} details for order ${order.orderNo}`}
      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm font-semibold text-blue-800 transition-colors duration-150 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-700"
    >
      Details
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m5 7.5 5 5 5-5" />
      </svg>
    </button>
  );
}

// Everything else about an order: the rejection reason, component counts and
// the actions that are still allowed.
function OrderDetails({
  order,
  recipes,
}: {
  order: OrderSummary;
  recipes: RecipeWithComponents[];
}) {
  const counted = order.items.some((item) => item.actualQty !== null);
  const editable = canEditOrder(order.status);
  const deletable = canDeleteOrder(order.status);

  return (
    <div className="motion-safe:animate-reveal">
      {order.status === "REJECTED" && order.latestRejection && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-950 ring-1 ring-red-700/25">
          <span className="font-semibold">
            Rejected by {order.latestRejection.verifierName} on{" "}
            {formatDateTime(order.latestRejection.at)}:
          </span>{" "}
          {order.latestRejection.note}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-900">
            <caption className="pb-2 text-left text-sm font-semibold text-slate-900">
              {counted ? "Component counts" : "Expected component counts"}
            </caption>
            <thead>
              <tr className="border-b border-slate-300 text-[11px] font-semibold tracking-wide text-slate-600 uppercase sm:text-xs sm:tracking-wider">
                <th scope="col" className="py-2 pr-1.5 sm:pr-3">
                  Component
                </th>
                <th
                  scope="col"
                  className={`px-1.5 py-2 sm:px-3 text-right ${counted ? "hidden sm:table-cell" : ""}`}
                >
                  Per garment
                </th>
                <th
                  scope="col"
                  className={`px-1.5 py-2 text-right sm:px-3 ${counted ? "hidden sm:table-cell" : ""}`}
                >
                  Expected
                </th>
                {counted && (
                  <>
                    <th scope="col" className="px-1.5 py-2 sm:px-3 text-right">
                      Counted
                    </th>
                    <th scope="col" className="py-2 pl-1.5 sm:pl-3">
                      Result
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {order.items.map((item) => (
                <tr key={item.componentId}>
                  <th scope="row" className="py-2 pr-1.5 font-normal sm:pr-3">
                    {item.componentName}
                  </th>
                  <td
                    className={`px-1.5 py-2 sm:px-3 text-right tabular-nums ${counted ? "hidden sm:table-cell" : ""}`}
                  >
                    {item.piecesPerGarment}
                  </td>
                  <td
                    className={`px-1.5 py-2 text-right font-medium tabular-nums sm:px-3 ${counted ? "hidden sm:table-cell" : ""}`}
                  >
                    {quantityFormat.format(item.expectedQty)}
                  </td>
                  {counted && (
                    <>
                      <td className="px-1.5 py-2 sm:px-3 text-right font-medium tabular-nums">
                        {item.actualQty === null
                          ? "—"
                          : quantityFormat.format(item.actualQty)}
                        {/* On a phone the expected count sits here, since
                            its own column is hidden. */}
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
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-slate-600">Created by</dt>
              <dd className="font-medium text-slate-900">
                {order.createdByName}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-600">Created</dt>
              <dd className="font-medium text-slate-900">
                {formatDateTime(order.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-600">Fabric used</dt>
              <dd className="font-medium text-slate-900 tabular-nums">
                {quantityFormat.format(order.actualFabricYds)} yd
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-600">Fabric expected</dt>
              <dd className="font-medium text-slate-900 tabular-nums">
                {quantityFormat.format(order.expectedFabricYds)} yd
              </dd>
            </div>
          </dl>

          {(editable || deletable) && (
            <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-slate-200 pt-5">
              {editable && (
                // Keyed on the last update so the form starts from the saved
                // values after each edit.
                <OrderDialog
                  key={order.updatedAt}
                  recipes={recipes}
                  order={order}
                />
              )}
              {deletable && (
                <DeleteOrderButton orderId={order.id} orderNo={order.orderNo} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  noOrders,
  onReset,
}: {
  noOrders: boolean;
  onReset: () => void;
}) {
  return (
    <div className="px-6 py-16 text-center">
      <span
        aria-hidden="true"
        className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-600 ring-1 ring-slate-900/[0.06]"
      >
        <svg
          viewBox="0 0 20 20"
          className="size-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6.5 10 3.5l6 3-6 3-6-3Z" />
          <path d="m4 10 6 3 6-3M4 13.5l6 3 6-3" />
        </svg>
      </span>
      <p className="mt-4 text-base font-semibold text-slate-900">
        {noOrders ? "No cutting orders yet" : "No orders match this view"}
      </p>
      <p className="mt-1 text-sm text-slate-700">
        {noOrders
          ? "Create the first one with “New cutting order”."
          : "Try another status, or clear the search."}
      </p>
      {!noOrders && (
        <button
          type="button"
          onClick={onReset}
          className={`mt-5 ${secondaryButtonClass}`}
        >
          Show all orders
        </button>
      )}
    </div>
  );
}
