import type { ReactNode } from "react";

const numberFormat = new Intl.NumberFormat("en-US", {
  minimumIntegerDigits: 2,
});

// A headline figure with a label, an icon and a one-line hint. Figures are
// shown with at least two digits ("05"). Given `onSelect` it becomes a button,
// which the order dashboard uses to filter its table; without it, it is a
// plain card. `children` is the icon's SVG path content.
export function StatCard({
  label,
  value,
  hint,
  tint,
  active = false,
  onSelect,
  children,
}: {
  label: string;
  value: number;
  hint: string;
  // Tailwind classes for the icon tile: background, icon colour and ring.
  tint: string;
  active?: boolean;
  onSelect?: () => void;
  children: ReactNode;
}) {
  const surface = `flex h-full w-full flex-col rounded-2xl bg-white p-5 text-left shadow-[0_1px_2px_rgb(15_23_42/0.05),0_10px_28px_-12px_rgb(15_23_42/0.14)] ${
    active ? "ring-2 ring-blue-700/70" : "ring-1 ring-slate-900/[0.05]"
  }`;
  const content = (
    <>
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span
          aria-hidden="true"
          className={`grid size-9 shrink-0 place-items-center rounded-xl ring-1 ${tint}`}
        >
          <svg
            viewBox="0 0 20 20"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {children}
          </svg>
        </span>
      </span>
      <span className="mt-3 text-4xl leading-none font-semibold tracking-tight text-slate-900 tabular-nums">
        {numberFormat.format(value)}
      </span>
      <span className="mt-2 text-sm text-slate-600">{hint}</span>
    </>
  );

  if (!onSelect) return <div className={surface}>{content}</div>;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`${surface} transition duration-200 ease-out hover:shadow-[0_1px_2px_rgb(15_23_42/0.06),0_16px_36px_-14px_rgb(15_23_42/0.22)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 motion-safe:hover:-translate-y-0.5`}
    >
      {content}
    </button>
  );
}
