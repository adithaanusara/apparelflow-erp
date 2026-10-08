import type { NextRequest } from "next/server";
import type { Role } from "../../lib/roles";
import { HttpError } from "../http";
import { SESSION_COOKIE, verifySessionToken, type Session } from "./session";

// API guard: 401 when there is no valid session.
export async function requireSession(request: NextRequest): Promise<Session> {
  const session = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (!session) {
    throw new HttpError(401, "UNAUTHENTICATED", "Sign in to continue.");
  }
  return session;
}

// API guard: 401 when not signed in, 403 when signed in with the wrong role.
// The role comes from the signed session cookie, never from the request body.
export async function requireRole(
  request: NextRequest,
  ...allowed: Role[]
): Promise<Session> {
  const session = await requireSession(request);
  if (!allowed.includes(session.role)) {
    throw new HttpError(
      403,
      "FORBIDDEN",
      "Your role is not allowed to perform this action.",
    );
  }
  return session;
}
