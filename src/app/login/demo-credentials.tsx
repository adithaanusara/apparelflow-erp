"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { DEMO_ACCOUNTS } from "@/lib/demo-accounts";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { Arrow, Spinner } from "./icons";

type DemoAccount = (typeof DEMO_ACCOUNTS)[number];

const ROLE_SUMMARY: Record<Role, string> = {
  cutting_supervisor: "Creates cutting orders and submits them to QC.",
  cutting_verifier: "Counts cut parts, then approves or rejects batches.",
  sewing_supervisor: "Receives verified batches and starts sewing.",
};

// Demo access, built into the foot of the sign-in card. A segmented control
// picks the factory role; the panel beneath shows that account's credentials
// with copy buttons and a one-click sign-in.
export function DemoCredentials({
  pendingRole,
  disabled,
  onSignIn,
}: {
  pendingRole: Role | null;
  disabled: boolean;
  onSignIn: (account: DemoAccount) => void;
}) {
  const [selected, setSelected] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const account = DEMO_ACCOUNTS[selected];
  const roleLabel = ROLE_LABELS[account.role];
  const signingIn = pendingRole === account.role;

  // Arrow keys move between roles, as in any tab list.
  function handleKeyDown(event: KeyboardEvent) {
    const last = DEMO_ACCOUNTS.length - 1;
    const next =
      event.key === "ArrowRight"
        ? (selected + 1) % (last + 1)
        : event.key === "ArrowLeft"
          ? (selected + last) % (last + 1)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    setSelected(next);
    tabs.current[next]?.focus();
  }

  async function copy(field: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
      setTimeout(
        () => setCopied((current) => (current === field ? null : current)),
        1600,
      );
    } catch {
      // Clipboard access can be blocked; the value is on screen to select.
      setCopied(null);
    }
  }

  return (
    <section
      aria-labelledby="demo-heading"
      className="border-t border-slate-200 bg-slate-50/80 px-7 py-5 motion-safe:animate-fade-in motion-safe:[animation-delay:380ms] sm:px-9"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="demo-heading" className="text-sm font-bold text-slate-900">
          Demo accounts
        </h3>
        <p className="text-xs text-slate-600">One per factory role</p>
      </div>

      <div
        role="tablist"
        aria-labelledby="demo-heading"
        onKeyDown={handleKeyDown}
        className="relative mt-3 grid grid-cols-3 rounded-xl bg-slate-200/80 p-1"
      >
        {/* The white pill that slides under the selected role. */}
        <span
          aria-hidden="true"
          style={{ transform: `translateX(${selected * 100}%)` }}
          className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-lg bg-white shadow-[0_1px_2px_rgb(15_23_42/0.12),0_2px_6px_rgb(15_23_42/0.08)] transition-transform duration-300 ease-out"
        />
        {DEMO_ACCOUNTS.map((option, index) => {
          const active = index === selected;
          return (
            <button
              key={option.role}
              ref={(element) => {
                tabs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`demo-tab-${option.role}`}
              aria-selected={active}
              aria-controls="demo-panel"
              tabIndex={active ? 0 : -1}
              onClick={() => setSelected(index)}
              className={`relative z-10 flex min-h-11 items-center justify-center rounded-lg px-2 py-1.5 text-center text-[13px] leading-tight font-semibold text-balance transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-700 ${
                active ? "text-blue-900" : "text-slate-700 hover:text-slate-900"
              }`}
            >
              {ROLE_LABELS[option.role]}
            </button>
          );
        })}
      </div>

      <div
        key={account.role}
        role="tabpanel"
        id="demo-panel"
        aria-labelledby={`demo-tab-${account.role}`}
        className="mt-4 motion-safe:animate-reveal"
      >
        <p className="text-sm text-slate-700">{ROLE_SUMMARY[account.role]}</p>

        <dl className="mt-3 divide-y divide-slate-200 rounded-xl bg-white shadow-[0_1px_2px_rgb(15_23_42/0.05)] ring-1 ring-slate-900/[0.07]">
          {(
            [
              ["Email", "email", account.email],
              ["Password", "password", account.password],
            ] as const
          ).map(([label, field, value]) => (
            <div
              key={field}
              className="flex items-center gap-3 py-1.5 pr-1.5 pl-3.5"
            >
              {/* Label above value, so a long email stays on one line. */}
              <div className="min-w-0 flex-1">
                <dt className="text-[11px] leading-4 font-semibold tracking-wider text-slate-600 uppercase">
                  {label}
                </dt>
                <dd className="font-mono text-[13px] leading-5 break-all text-slate-900 sm:text-sm">
                  {value}
                </dd>
              </div>
              <button
                type="button"
                onClick={() => copy(field, value)}
                aria-label={`Copy ${label.toLowerCase()} for ${roleLabel}`}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-700 ${
                  copied === field
                    ? "bg-green-50 text-green-800"
                    : "text-blue-800 hover:bg-blue-50"
                }`}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  className="size-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {copied === field ? (
                    <path d="m4.5 10.5 3.5 3.5 7.5-8" />
                  ) : (
                    <>
                      <rect x="7" y="7" width="9.5" height="9.5" rx="2" />
                      <path d="M13 7V5.5a2 2 0 0 0-2-2H5.5a2 2 0 0 0-2 2V11a2 2 0 0 0 2 2H7" />
                    </>
                  )}
                </svg>
                {copied === field ? "Copied" : "Copy"}
              </button>
            </div>
          ))}
        </dl>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onSignIn(account)}
          className="group mt-3.5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-blue-900 shadow-[0_1px_2px_rgb(15_23_42/0.06)] ring-1 ring-slate-900/15 transition duration-200 ease-out hover:bg-blue-50 hover:shadow-[0_6px_16px_-8px_rgb(30_58_138/0.45)] hover:ring-blue-700/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-700 disabled:shadow-none disabled:ring-slate-300 motion-safe:active:scale-[0.985]"
        >
          {signingIn ? (
            <>
              <Spinner />
              Signing in…
            </>
          ) : (
            <>
              Sign in as {roleLabel}
              <Arrow />
            </>
          )}
        </button>
      </div>
      <p aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard." : ""}
      </p>
    </section>
  );
}
