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
        className="inline-flex flex-wrap overflow-hidden rounded-md border border-slate-500 bg-white"
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
              className={`px-3 py-1.5 text-sm font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-wait ${
                active
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-900 hover:bg-slate-200"
              }`}
            >
              {switchingTo === role ? "Switching…" : ROLE_LABELS[role]}
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-sm font-medium text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
