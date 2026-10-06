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

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-300 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <div>
            <p className="text-lg font-bold text-slate-900">ApparelFlow ERP</p>
            <p className="text-sm text-slate-700">
              Signed in as{" "}
              <span className="font-semibold text-slate-900">
                {session.fullName}
              </span>{" "}
              ({ROLE_LABELS[session.role]})
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-3">
            <RoleSwitcher currentRole={session.role} />
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
