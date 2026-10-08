import { defineConfig } from "drizzle-kit";

// Only used to generate SQL migrations from the schema (no connection needed).
// Migrations are applied by src/server/db/migrate.ts.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
});
