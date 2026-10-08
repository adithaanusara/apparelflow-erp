import { NextResponse } from "next/server";
import { authenticate } from "@/server/auth/login";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { HttpError, readJsonObject, route, type FieldErrors } from "@/server/http";

const MAX_CREDENTIAL_LENGTH = 200;

export const POST = route(async (request) => {
  const body = await readJsonObject(request);
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const fieldErrors: FieldErrors = {};
  if (!email) fieldErrors.email = "Email is required.";
  else if (email.length > MAX_CREDENTIAL_LENGTH) {
    fieldErrors.email = "Email is too long.";
  }
  if (!password) fieldErrors.password = "Password is required.";
  else if (password.length > MAX_CREDENTIAL_LENGTH) {
    fieldErrors.password = "Password is too long.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw new HttpError(
      422,
      "VALIDATION_FAILED",
      "Enter your email and password.",
      fieldErrors,
    );
  }

  const session = await authenticate(getDb(), email, password);
  if (!session) {
    throw new HttpError(
      401,
      "INVALID_CREDENTIALS",
      "Invalid email or password.",
    );
  }

  const response = NextResponse.json({ user: session });
  response.cookies.set(
    SESSION_COOKIE,
    await createSessionToken(session),
    sessionCookieOptions(),
  );
  return response;
});
