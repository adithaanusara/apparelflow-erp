import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { createNeonDatabase, requireDatabaseUrl } from "./client";

async function main() {
  const { db, pool } = createNeonDatabase(requireDatabaseUrl());
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations applied.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
