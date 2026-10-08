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
    <div>
      <div
        role="group"
        aria-label="Switch demo role"
        className="inline-flex flex-wrap gap-1 rounded-xl bg-white/10 p-1 ring-1 ring-white/15"
      >
        {DEMO_ACCOUNTS.map(({ role }) => {
          const active = role === currentRole;
          return (
            <button
              key={role}
              type="button"
              aria-pressed={active}
              disabled={switchingTo !== null}
              onClick={() => switchTo(role)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white disabled:cursor-wait ${
                active
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              {switchingTo === role ? "Switching…" : ROLE_LABELS[role]}
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
