import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

// Driver-agnostic handle, so the same code runs on Neon and on PGlite.
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
    );
  }
  return url;
}

// The pooled (WebSocket) driver is used because approvals need transactions.
export function createNeonDatabase(connectionString: string) {
  const pool = new Pool({ connectionString });
  return { db: drizzle(pool, { schema }), pool };
}

let cached: Database | undefined;

// Connects on first use so that importing this module never requires
// DATABASE_URL (e.g. during `next build`).
export function getDb(): Database {
  cached ??= createNeonDatabase(requireDatabaseUrl()).db;
  return cached;
}
