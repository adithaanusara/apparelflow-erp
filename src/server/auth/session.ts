import { SignJWT, jwtVerify } from "jose";
import { isRole, type Role } from "../../lib/roles";

export const SESSION_COOKIE = "af_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const ALGORITHM = "HS256";

export type Session = {
  userId: number;
  role: Role;
  fullName: string;
  email: string;
};

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to at least 32 characters. Generate one with `openssl rand -base64 32`.",
    );
  }
  return new TextEncoder().encode(secret);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  } as const;
}

export async function createSessionToken(session: Session): Promise<string> {
  return new SignJWT({
    role: session.role,
    name: session.fullName,
    email: session.email,
  })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(String(session.userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

// Returns null for a missing, expired, tampered or malformed token.
export async function verifySessionToken(
  token: string | undefined,
): Promise<Session | null> {
  if (!token) return null;
  // Resolved outside the try so a missing secret is a loud server error
  // rather than looking like "not signed in".
  const key = secretKey();
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: [ALGORITHM],
    });
    const userId = Number(payload.sub);
    if (
      !Number.isInteger(userId) ||
      userId < 1 ||
      !isRole(payload.role) ||
      typeof payload.name !== "string" ||
      typeof payload.email !== "string"
    ) {
      return null;
    }
    return {
      userId,
      role: payload.role,
      fullName: payload.name,
      email: payload.email,
    };
  } catch {
    return null;
  }
}
