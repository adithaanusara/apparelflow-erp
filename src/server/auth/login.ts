import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { users } from "../db/schema";
import type { Session } from "./session";

// Compared against when the email is unknown, so a miss costs the same time
// as a wrong password and does not reveal which emails exist.
let decoyHash: Promise<string> | undefined;

export async function authenticate(
  db: Database,
  email: string,
  password: string,
): Promise<Session | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  decoyHash ??= bcrypt.hash("decoy-password-never-matches", 10);
  const matches = await bcrypt.compare(
    password,
    user?.passwordHash ?? (await decoyHash),
  );
  if (!user || !matches) return null;

  return {
    userId: user.id,
    role: user.role,
    fullName: user.fullName,
    email: user.email,
  };
}
