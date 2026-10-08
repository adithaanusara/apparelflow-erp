import { pathToFileURL } from "node:url";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { DEMO_ACCOUNTS } from "../../lib/demo-accounts";
import {
  createNeonDatabase,
  requireDatabaseUrl,
  type Database,
} from "./client";
import { recipeComponents, recipes, users } from "./schema";

const BCRYPT_ROUNDS = 10;

export const SEED_RECIPES = [
  {
    recipeCode: "REC-BL01",
    name: "Casual Blouse",
    category: "Blouse",
    stdFabricYards: 1.8,
    wastageCap: 5.0,
    components: [
      { componentName: "Front Body Panel", piecesPerGarment: 1 },
      { componentName: "Back Body Panel", piecesPerGarment: 1 },
      { componentName: "Sleeves (Left & Right)", piecesPerGarment: 2 },
      { componentName: "Collar & Stand", piecesPerGarment: 1 },
      { componentName: "Sleeve Cuffs", piecesPerGarment: 2 },
    ],
  },
  {
    recipeCode: "REC-CT02",
    name: "Crop Top",
    category: "Crop Top",
    stdFabricYards: 1.1,
    wastageCap: 8.0,
    components: [
      { componentName: "Front Chest Panel", piecesPerGarment: 1 },
      { componentName: "Back Support Panel", piecesPerGarment: 1 },
      { componentName: "Neck Binding Strip", piecesPerGarment: 1 },
      { componentName: "Hem Elastic Casing", piecesPerGarment: 1 },
      { componentName: "Side Strap Accents", piecesPerGarment: 2 },
    ],
  },
] as const;

// Idempotent: safe to run repeatedly without duplicating rows.
export async function seed(db: Database) {
  for (const { password, ...user } of DEMO_ACCOUNTS) {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await db
      .insert(users)
      .values({ ...user, passwordHash })
      .onConflictDoUpdate({
        target: users.email,
        set: { passwordHash, role: user.role, fullName: user.fullName },
      });
  }

  for (const { components, ...recipe } of SEED_RECIPES) {
    const [{ id: recipeId }] = await db
      .insert(recipes)
      .values(recipe)
      .onConflictDoUpdate({
        target: recipes.recipeCode,
        set: {
          name: recipe.name,
          category: recipe.category,
          stdFabricYards: recipe.stdFabricYards,
          wastageCap: recipe.wastageCap,
        },
      })
      .returning({ id: recipes.id });

    await db
      .insert(recipeComponents)
      .values(components.map((component) => ({ ...component, recipeId })))
      .onConflictDoUpdate({
        target: [recipeComponents.recipeId, recipeComponents.componentName],
        set: { piecesPerGarment: sql`excluded.pieces_per_garment` },
      });
  }
}

async function main() {
  const { db, pool } = createNeonDatabase(requireDatabaseUrl());
  try {
    await seed(db);
    console.log(
      `Seeded ${DEMO_ACCOUNTS.length} demo users and ${SEED_RECIPES.length} recipes.`,
    );
  } finally {
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
