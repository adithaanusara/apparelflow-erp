import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Database } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { seed } from "@/server/db/seed";

// A throwaway in-memory Postgres built from the real migrations and seed, so
// tests exercise the same constraints as production without touching Neon.
export async function createTestDb(): Promise<Database> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  await seed(db);
  return db;
}
