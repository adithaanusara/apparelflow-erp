import { redirect } from "next/navigation";
import { ROLE_HOME } from "@/lib/roles";
import { getPageSession } from "@/server/auth/page-session";

export default async function Home() {
  const session = await getPageSession();
  redirect(session ? ROLE_HOME[session.role] : "/login");
}
