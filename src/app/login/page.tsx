import { redirect } from "next/navigation";
import { ROLE_HOME } from "@/lib/roles";
import { getPageSession } from "@/server/auth/page-session";
import { LoginForm } from "./login-form";
import { LoginHero } from "./login-hero";

export default async function LoginPage() {
  const session = await getPageSession();
  if (session) redirect(ROLE_HOME[session.role]);

  return (
    <div className="grid min-h-screen bg-slate-50 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <LoginHero />
      {/* A faint wash of the brand blue ties this side to the hero. */}
      <main className="flex items-start justify-center bg-[radial-gradient(56rem_36rem_at_100%_0%,rgb(219_234_254/0.7),transparent_70%)] px-4 py-10 sm:px-8 lg:items-center lg:py-6">
        <LoginForm />
      </main>
    </div>
  );
}
