"use client";

import { useState, type FormEvent } from "react";
import {
  fieldErrorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { postJson } from "@/lib/api-client";
import { DEMO_ACCOUNTS } from "@/lib/demo-accounts";
import { ROLE_HOME, ROLE_LABELS, type Role } from "@/lib/roles";

const ROLE_SUMMARY: Record<Role, string> = {
  cutting_supervisor:
    "Creates cutting orders from recipes and submits them for verification.",
  cutting_verifier:
    "Counts cut parts per component and approves or rejects batches.",
  sewing_supervisor: "Receives verified batches in the Sewing Queue.",
};

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signIn(credentials: { email: string; password: string }) {
    setPending(true);
    setFormError(null);
    setFieldErrors({});
    const result = await postJson<{ user: { role: Role } }>(
      "/api/auth/login",
      credentials,
    );
    if (!result.ok) {
      setPending(false);
      setFieldErrors(result.error.fieldErrors ?? {});
      if (!result.error.fieldErrors) setFormError(result.error.message);
      return;
    }
    // Full page load so the previous session's pages are not reused.
    window.location.assign(ROLE_HOME[result.data.user.role]);
  }

  function clearFieldError(field: string) {
    setFieldErrors((current) => ({ ...current, [field]: "" }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    signIn({ email, password });
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <section
        aria-labelledby="sign-in-heading"
        className="rounded-lg border border-slate-300 bg-white p-6"
      >
        <h2 id="sign-in-heading" className="text-lg font-bold text-slate-900">
          Sign in
        </h2>
        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                clearFieldError("email");
              }}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
              className={`mt-1 ${inputClass}`}
            />
            {fieldErrors.email && (
              <p id="email-error" className={fieldErrorClass}>
                {fieldErrors.email}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                clearFieldError("password");
              }}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={
                fieldErrors.password ? "password-error" : undefined
              }
              className={`mt-1 ${inputClass}`}
            />
            {fieldErrors.password && (
              <p id="password-error" className={fieldErrorClass}>
                {fieldErrors.password}
              </p>
            )}
          </div>
          {formError && (
            <p
              role="alert"
              className="rounded-md border border-red-700 bg-red-50 px-3 py-2 text-sm font-medium text-red-900"
            >
              {formError}
            </p>
          )}
          <button type="submit" disabled={pending} className={primaryButtonClass}>
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>

      <section
        aria-labelledby="demo-heading"
        className="rounded-lg border border-slate-300 bg-white p-6"
      >
        <h2 id="demo-heading" className="text-lg font-bold text-slate-900">
          Demo credentials
        </h2>
        <p className="mt-1 text-sm text-slate-700">
          One account per factory role. Each button signs in with the
          credentials shown.
        </p>
        <ul className="mt-4 space-y-3">
          {DEMO_ACCOUNTS.map((account) => (
            <li
              key={account.role}
              className="rounded-md border border-slate-300 bg-slate-50 p-4"
            >
              <p className="font-semibold text-slate-900">
                {ROLE_LABELS[account.role]}
              </p>
              <p className="mt-0.5 text-sm text-slate-700">
                {ROLE_SUMMARY[account.role]}
              </p>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 text-sm">
                <dt className="text-slate-700">Email</dt>
                <dd className="font-mono break-all text-slate-900">
                  {account.email}
                </dd>
                <dt className="text-slate-700">Password</dt>
                <dd className="font-mono text-slate-900">{account.password}</dd>
              </dl>
              <button
                type="button"
                disabled={pending}
                onClick={() => signIn(account)}
                className={`mt-3 ${secondaryButtonClass}`}
              >
                Sign in as {ROLE_LABELS[account.role]}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
