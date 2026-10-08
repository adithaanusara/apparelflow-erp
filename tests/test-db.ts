import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Database } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { cuttingOrders, users, verificationLogs } from "@/server/db/schema";
import { seed } from "@/server/db/seed";

// A throwaway in-memory Postgres built from the real migrations and seed, so
// tests exercise the same constraints as production without touching Neon.
export async function createTestDb(): Promise<Database> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  await seed(db);
  return db;
}

// Records a verifier's decision straight in the database, for tests that need
// an order in VERIFIED or REJECTED without going through the API. It is
// written the only way the database accepts: the signed audit row and the
// status change in one transaction. `log` overrides fields of the audit row.
export async function signOff(
  db: Database,
  orderId: number,
  decision: "APPROVED" | "REJECTED",
  log: Partial<typeof verificationLogs.$inferInsert> = {},
): Promise<void> {
  const [verifier] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "cutting_verifier"))
    .limit(1);
  await db.transaction(async (tx) => {
    await tx.insert(verificationLogs).values({
      orderId,
      verifierId: verifier.id,
      decision,
      rejectionNote: decision === "REJECTED" ? "Rejected by a test" : null,
      wastagePct: 0,
      ...log,
    });
    await tx
      .update(cuttingOrders)
      .set({ status: decision === "APPROVED" ? "VERIFIED" : "REJECTED" })
      .where(eq(cuttingOrders.id, orderId));
  });
}
