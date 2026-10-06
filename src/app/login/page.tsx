import { redirect } from "next/navigation";
import { ROLE_HOME } from "@/lib/roles";
import { getPageSession } from "@/server/auth/page-session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getPageSession();
  if (session) redirect(ROLE_HOME[session.role]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">ApparelFlow ERP</h1>
      <p className="mt-1 text-slate-700">
        Cutting Operations &amp; Gatekeeper Verification Terminal
      </p>
      <LoginForm />
    </main>
  );
}
