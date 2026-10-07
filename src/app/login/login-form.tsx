"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { postJson } from "@/lib/api-client";
import { ROLE_HOME, type Role } from "@/lib/roles";
import { DemoCredentials } from "./demo-credentials";
import { Arrow, Spinner } from "./icons";

type Credentials = { email: string; password: string };

// Text and background are always set together, on every state, so a field can
// never end up with unreadable text. The border is dark enough to be seen on
// its own, and focus adds the brand-blue border and a soft ring.
const fieldClass =
  "peer block h-12 w-full rounded-xl border border-[#8492a6] bg-white pr-3.5 pl-11 text-base text-slate-900 shadow-[inset_0_1px_2px_rgb(15_23_42/0.05)] transition-[border-color,box-shadow] duration-200 ease-out placeholder:text-slate-500 hover:border-slate-600 focus:border-blue-700 focus:shadow-[inset_0_1px_2px_rgb(15_23_42/0.05),0_0_0_4px_rgb(29_78_216/0.16)] focus:outline-none aria-invalid:border-red-700 aria-invalid:focus:shadow-[inset_0_1px_2px_rgb(15_23_42/0.05),0_0_0_4px_rgb(185_28_28/0.16)] motion-safe:aria-invalid:animate-shake";

const labelClass = "block text-sm font-semibold text-slate-900";

const fieldIconClass =
  "pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-slate-500 transition-colors duration-200 peer-focus:text-blue-700 peer-aria-invalid:text-red-700";

const errorClass =
  "mt-1.5 flex items-start gap-1.5 text-sm font-medium text-red-800 motion-safe:animate-reveal";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  // Counts sign-in attempts so a repeated error replays its entry animation.
  const [attempt, setAttempt] = useState(0);
  // Which sign-in is in flight: the form, or one demo role's button.
  const [pending, setPending] = useState<"form" | Role | null>(null);

  async function signIn(credentials: Credentials, source: "form" | Role) {
    setPending(source);
    setFormError(null);
    setFieldErrors({});
    const result = await postJson<{ user: { role: Role } }>(
      "/api/auth/login",
      credentials,
    );
    if (!result.ok) {
      setPending(null);
      setAttempt((count) => count + 1);
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
    signIn({ email, password }, "form");
  }

  const busy = pending !== null;

  return (
    <div className="w-full max-w-[27rem]">
      {/* One elevated surface: the sign-in form above, demo access below.
          Depth comes from layered shadows, not a drawn border. */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgb(15_23_42/0.06),0_14px_32px_-10px_rgb(15_23_42/0.14),0_36px_72px_-28px_rgb(30_58_138/0.28)] ring-1 ring-slate-900/[0.05] motion-safe:animate-rise">
        <section
          aria-labelledby="sign-in-heading"
          className="px-7 pt-7 pb-6 sm:px-9 sm:pt-8 sm:pb-7"
        >
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-blue-800 uppercase motion-safe:animate-rise motion-safe:[animation-delay:60ms]">
            <span
              aria-hidden="true"
              className="grid size-6 place-items-center rounded-md bg-blue-50 ring-1 ring-blue-700/15"
            >
              <svg viewBox="0 0 20 20" className="size-3.5" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 2a4 4 0 0 0-4 4v2H5.5A1.5 1.5 0 0 0 4 9.5v7A1.5 1.5 0 0 0 5.5 18h9a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 14.5 8H14V6a4 4 0 0 0-4-4Zm2.5 6V6a2.5 2.5 0 0 0-5 0v2h5Z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            Secure sign-in
          </p>
          <h2
            id="sign-in-heading"
            className="mt-4 text-[1.75rem] leading-tight font-bold tracking-tight text-slate-900 motion-safe:animate-rise motion-safe:[animation-delay:100ms]"
          >
            Welcome back
          </h2>
          <p className="mt-1.5 text-slate-700 motion-safe:animate-rise motion-safe:[animation-delay:140ms]">
            Sign in to open your ApparelFlow workspace.
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <div className="motion-safe:animate-rise motion-safe:[animation-delay:200ms]">
              <label htmlFor="email" className={labelClass}>
                Email
              </label>
              <div className="relative mt-1.5">
                <input
                  key={`email-${attempt}`}
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="you@apparelflow.demo"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    clearFieldError("email");
                  }}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={
                    fieldErrors.email ? "email-error" : undefined
                  }
                  className={fieldClass}
                />
                <FieldIcon>
                  <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h11A1.5 1.5 0 0 1 17 5.5v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5v-9Z" />
                  <path d="m3.5 6 6.5 5 6.5-5" />
                </FieldIcon>
              </div>
              {fieldErrors.email && (
                <p id="email-error" className={errorClass}>
                  <ErrorIcon />
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div className="motion-safe:animate-rise motion-safe:[animation-delay:260ms]">
              <label htmlFor="password" className={labelClass}>
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  key={`password-${attempt}`}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    clearFieldError("password");
                  }}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={
                    fieldErrors.password ? "password-error" : undefined
                  }
                  className={`pr-18 ${fieldClass}`}
                />
                <FieldIcon>
                  <path d="M5.5 9h9A1.5 1.5 0 0 1 16 10.5v5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 15.5v-5A1.5 1.5 0 0 1 5.5 9Z" />
                  <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
                </FieldIcon>
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-pressed={showPassword}
                  aria-controls="password"
                  className="absolute inset-y-1.5 right-1.5 rounded-lg px-3 text-sm font-semibold text-blue-800 transition-colors duration-150 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-700"
                >
                  {showPassword ? "Hide" : "Show"}
                  <span className="sr-only"> password</span>
                </button>
              </div>
              {fieldErrors.password && (
                <p id="password-error" className={errorClass}>
                  <ErrorIcon />
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {formError && (
              <p
                key={`form-error-${attempt}`}
                role="alert"
                className="flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-3 text-sm font-medium text-red-900 ring-1 ring-red-700/25 motion-safe:animate-shake"
              >
                <ErrorIcon />
                {formError}
              </p>
            )}

            <div className="pt-1 motion-safe:animate-rise motion-safe:[animation-delay:320ms]">
              <button
                type="submit"
                disabled={busy}
                className="group relative inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-b from-blue-700 to-blue-900 text-base font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_10px_24px_-10px_rgb(30_58_138/0.75)] transition duration-200 ease-out hover:from-blue-600 hover:to-blue-800 hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_14px_28px_-10px_rgb(30_58_138/0.8)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-700 disabled:shadow-none motion-safe:hover:scale-[1.015] motion-safe:active:scale-[0.985] motion-safe:disabled:scale-100"
              >
                {pending === "form" ? (
                  <>
                    <Spinner />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in
                    <Arrow />
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        <DemoCredentials
          pendingRole={pending !== null && pending !== "form" ? pending : null}
          disabled={busy}
          onSignIn={(account) => signIn(account, account.role)}
        />
      </div>

      <p className="mt-4 text-center text-xs text-slate-600 motion-safe:animate-fade-in motion-safe:[animation-delay:500ms]">
        Role permissions are enforced on the server for every request.
      </p>
    </div>
  );
}

function FieldIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={fieldIconClass}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="mt-0.5 size-4 shrink-0"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-12.5a.9.9 0 0 1 .9.9v3.7a.9.9 0 1 1-1.8 0V6.4a.9.9 0 0 1 .9-.9Zm0 8.6a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
