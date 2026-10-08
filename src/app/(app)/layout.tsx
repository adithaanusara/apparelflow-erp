import { RoleSwitcher } from "@/components/role-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { ROLE_LABELS } from "@/lib/roles";
import { requirePageRole } from "@/server/auth/page-session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requirePageRole();
  const initials = session.fullName
    .split(/\s+/)
    .filter((word) => word !== "Demo")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* The same deep navy as the sign-in page's hero. */}
      <header className="bg-slate-950 bg-linear-to-r from-slate-950 via-[#17284a] to-slate-950 text-white shadow-[0_1px_0_rgb(255_255_255/0.06)_inset,0_8px_24px_-12px_rgb(2_6_23/0.6)]">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-10 place-items-center rounded-xl bg-white/10 ring-1 ring-white/25"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none">
                <path
                  d="M4 6.5 12 3l8 3.5v11L12 21l-8-3.5v-11Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path
                  d="m8 12.2 2.7 2.7L16 9.6"
                  className="stroke-blue-300"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div>
              <p className="text-base leading-tight font-semibold tracking-tight">
                ApparelFlow ERP
              </p>
              <p className="text-xs text-slate-300">
                Cutting &amp; Gatekeeper Verification
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <RoleSwitcher currentRole={session.role} />
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="grid size-9 place-items-center rounded-full bg-white/15 text-xs font-bold tracking-wide ring-1 ring-white/25"
              >
                {initials}
              </span>
              <p className="text-sm leading-tight">
                <span className="sr-only">Signed in as </span>
                <span className="block font-semibold">{session.fullName}</span>
                <span className="block text-xs text-slate-300">
                  {ROLE_LABELS[session.role]}
                </span>
              </p>
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
