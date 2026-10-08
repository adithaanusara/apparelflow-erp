import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ROLE_HOME, type Role } from "../../lib/roles";
import { SESSION_COOKIE, verifySessionToken, type Session } from "./session";

// Session for Server Components. Cached per request so the layout and the
// page share one verification.
export const getPageSession = cache(async (): Promise<Session | null> => {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
});

// Page guard: signed-out visitors go to the sign-in page, and a signed-in user
// with the wrong role goes back to their own workspace. Pages are a
// convenience; the API guards are what actually protect the data.
export async function requirePageRole(...allowed: Role[]): Promise<Session> {
  const session = await getPageSession();
  if (!session) redirect("/login");
  if (allowed.length > 0 && !allowed.includes(session.role)) {
    redirect(ROLE_HOME[session.role]);
  }
  return session;
}
