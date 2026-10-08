"use client";

import { useState } from "react";
import { postJson } from "@/lib/api-client";
import { DEMO_ACCOUNTS } from "@/lib/demo-accounts";
import { ROLE_HOME, ROLE_LABELS, type Role } from "@/lib/roles";

// Switching role is a real sign-in as that role's demo account: it goes
// through the same login endpoint and replaces the session cookie.
export function RoleSwitcher({ currentRole }: { currentRole: Role }) {
  const [switchingTo, setSwitchingTo] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function switchTo(role: Role) {
    const account = DEMO_ACCOUNTS.find((candidate) => candidate.role === role);
    if (!account) return;
    setSwitchingTo(role);
    setError(null);
    const result = await postJson("/api/auth/login", {
      email: account.email,
      password: account.password,
    });
    if (!result.ok) {
      setSwitchingTo(null);
      setError(result.error.message);
      return;
    }
    // Full page load so the previous session's pages are not reused.
    window.location.assign(ROLE_HOME[role]);
  }

  return (
    <div className="w-full sm:w-auto">
      {/* On a phone the three roles share the full width as equal columns,
          each label on two lines (department over job title), so none of
          them wraps onto a row of its own. From the `sm` size up they sit in
          one line as plain labels. */}
      <div
        role="group"
        aria-label="Switch demo role"
        className="grid grid-cols-3 gap-1 rounded-xl bg-white/10 p-1 ring-1 ring-white/15 sm:inline-flex"
      >
        {DEMO_ACCOUNTS.map(({ role }) => {
          const active = role === currentRole;
          const [department, ...title] = ROLE_LABELS[role].split(" ");
          return (
            <button
              key={role}
              type="button"
              aria-pressed={active}
              disabled={switchingTo !== null}
              onClick={() => switchTo(role)}
              className={`flex min-h-11 flex-col items-center justify-center rounded-lg px-1 py-1.5 text-center text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white disabled:cursor-wait sm:block sm:min-h-0 sm:px-3 sm:whitespace-nowrap ${
                active
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              {switchingTo === role ? (
                "Switching…"
              ) : (
                <>
                  <span className="block text-[11px] leading-4 tracking-wider uppercase sm:inline sm:text-sm sm:leading-5 sm:tracking-normal sm:normal-case">
                    {department}
                  </span>{" "}
                  <span className="block text-[13px] leading-[1.15rem] sm:inline sm:text-sm sm:leading-5">
                    {title.join(" ")}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-sm font-medium text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
