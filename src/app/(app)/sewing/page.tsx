import { TrafficLight } from "@/components/traffic-light";
import { requirePageRole } from "@/server/auth/page-session";
import { getDb } from "@/server/db/client";
import { listSewingQueue, type SewingBatch } from "@/server/sewing/service";
import { StartSewingButton } from "./start-sewing-button";

const quantityFormat = new Intl.NumberFormat("en-US");
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});
const formatDate = (iso: string) => `${dateFormat.format(new Date(iso))} UTC`;

export default async function SewingPage() {
  await requirePageRole("sewing_supervisor");
  const batches = await listSewingQueue(getDb());
  const ready = batches.filter((batch) => batch.sewing === null);
  const started = batches.filter((batch) => batch.sewing !== null).reverse();

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Sewing Queue</h1>
      <p className="mt-1 max-w-prose text-slate-700">
        Only batches verified and signed off by a Cutting Verifier appear here.
      </p>

      <BatchSection
        title="Ready for sewing"
        emptyText="No verified batches are waiting. A batch appears here as soon as a Cutting Verifier approves it."
        batches={ready}
      />
      {started.length > 0 && (
        <BatchSection title="Sewing started" emptyText="" batches={started} />
      )}
    </>
  );
}

function BatchSection({
  title,
  emptyText,
  batches,
}: {
  title: string;
  emptyText: string;
  batches: SewingBatch[];
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-slate-900">
        {title} ({batches.length})
      </h2>
      {batches.length === 0 ? (
        <p className="mt-3 rounded-lg border border-slate-300 bg-white p-6 text-slate-700">
          {emptyText}
        </p>
      ) : (
        <ul className="mt-3 space-y-4">
          {batches.map((batch) => (
            <li key={batch.id}>
              <BatchCard batch={batch} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BatchCard({ batch }: { batch: SewingBatch }) {
  const titleId = `batch-${batch.id}-title`;

  return (
    <article
      aria-labelledby={titleId}
      className="rounded-lg border border-slate-300 bg-white p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id={titleId}
            className="font-mono text-lg font-bold text-slate-900"
          >
            {batch.orderNo}
          </h3>
          <p className="text-slate-900">
            {batch.recipe.recipeCode} — {batch.recipe.name},{" "}
            {quantityFormat.format(batch.targetQty)} garments
          </p>
        </div>
        <span className="rounded-full border border-green-700 bg-green-100 px-3 py-1 text-sm font-semibold text-green-950">
          Verified
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-slate-700">Verified by</dt>
          <dd className="font-semibold text-slate-900">
            {batch.approval?.verifierName ?? "No sign-off record"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-700">Verified on</dt>
          <dd className="font-semibold text-slate-900">
            {batch.approval ? formatDate(batch.approval.at) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-700">Fabric roll</dt>
          <dd className="font-mono font-semibold break-all text-slate-900">
            {batch.fabricRollId}
          </dd>
        </div>
        <div>
          <dt className="text-slate-700">
            Fabric wastage (cap {batch.recipe.wastageCap}%)
          </dt>
          <dd className="font-semibold text-slate-900 tabular-nums">
            {batch.approval ? `${batch.approval.wastagePct}%` : "—"}
            <span className="font-normal text-slate-700">
              {" "}
              ({quantityFormat.format(batch.actualFabricYds)} of{" "}
              {quantityFormat.format(batch.expectedFabricYds)} yd)
            </span>
          </dd>
        </div>
      </dl>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full max-w-2xl text-left text-sm text-slate-900">
          <caption className="pb-1 text-left font-semibold">
            Verified piece counts
          </caption>
          <thead>
            <tr className="border-b border-slate-400">
              <th scope="col" className="py-1.5 font-semibold">
                Component
              </th>
              <th
                scope="col"
                className="py-1.5 pl-2 sm:pl-4 text-right font-semibold"
              >
                Expected
              </th>
              <th
                scope="col"
                className="py-1.5 pl-2 sm:pl-4 text-right font-semibold"
              >
                Counted
              </th>
              <th scope="col" className="py-1.5 pl-2 sm:pl-4 font-semibold">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {batch.items.map((item) => (
              <tr key={item.componentId} className="border-b border-slate-200">
                <th scope="row" className="py-1.5 font-normal">
                  {item.componentName}
                </th>
                <td className="py-1.5 pl-2 sm:pl-4 text-right tabular-nums">
                  {quantityFormat.format(item.expectedQty)}
                </td>
                <td className="py-1.5 pl-2 sm:pl-4 text-right font-semibold tabular-nums">
                  {item.actualQty === null
                    ? "—"
                    : quantityFormat.format(item.actualQty)}
                </td>
                <td className="py-1.5 pl-2 sm:pl-4">
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

      <div className="mt-4 text-sm">
        <h4 className="font-semibold text-slate-900">Verifier audit notes</h4>
        {batch.rejections.length === 0 ? (
          <p className="text-slate-700">
            Approved on the first verification. No rejections recorded.
          </p>
        ) : (
          <ul className="mt-1 space-y-1">
            {batch.rejections.map((rejection) => (
              <li
                key={rejection.at}
                className="rounded-md border border-amber-700 bg-amber-50 px-3 py-2 text-amber-950"
              >
                <span className="font-semibold">
                  Rejected by {rejection.verifierName} on{" "}
                  {formatDate(rejection.at)}, then re-cut and approved:
                </span>{" "}
                {rejection.note}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
        {batch.sewing ? (
          <p className="rounded-md border border-blue-800 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-950">
            Sewing assembly started by {batch.sewing.startedByName} on{" "}
            {formatDate(batch.sewing.at)}
          </p>
        ) : (
          <StartSewingButton orderId={batch.id} orderNo={batch.orderNo} />
        )}
      </div>
    </article>
  );
}
