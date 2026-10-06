import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { ORDER_STATUSES } from "../../lib/order-rules";
import { ROLES } from "../../lib/roles";
import { ITEM_STATUSES } from "../../lib/verification-rules";

export const userRole = pgEnum("user_role", ROLES);

export const orderStatus = pgEnum("order_status", ORDER_STATUSES);

export const itemStatus = pgEnum("item_status", ITEM_STATUSES);

export const verificationDecision = pgEnum("verification_decision", [
  "APPROVED",
  "REJECTED",
]);

export const users = pgTable("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  email: text().notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRole().notNull(),
  fullName: text("full_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const recipes = pgTable(
  "recipes",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    recipeCode: text("recipe_code").notNull().unique(),
    name: text().notNull(),
    category: text().notNull(),
    stdFabricYards: numeric("std_fabric_yards", {
      precision: 6,
      scale: 2,
      mode: "number",
    }).notNull(),
    wastageCap: numeric("wastage_cap", {
      precision: 5,
      scale: 2,
      mode: "number",
    }).notNull(),
  },
  (t) => [
    check("recipes_std_fabric_yards_positive", sql`${t.stdFabricYards} > 0`),
    check("recipes_wastage_cap_non_negative", sql`${t.wastageCap} >= 0`),
  ],
);

export const recipeComponents = pgTable(
  "recipe_components",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    componentName: text("component_name").notNull(),
    piecesPerGarment: integer("pieces_per_garment").notNull(),
    imageUrl: text("image_url"),
  },
  (t) => [
    unique("recipe_components_recipe_component_unique").on(
      t.recipeId,
      t.componentName,
    ),
    check(
      "recipe_components_pieces_per_garment_positive",
      sql`${t.piecesPerGarment} > 0`,
    ),
  ],
);

export const cuttingOrders = pgTable(
  "cutting_orders",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    orderNo: text("order_no").notNull().unique(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id),
    targetQty: integer("target_qty").notNull(),
    fabricRollId: text("fabric_roll_id").notNull(),
    actualFabricYds: numeric("actual_fabric_yds", {
      precision: 10,
      scale: 2,
      mode: "number",
    }).notNull(),
    status: orderStatus().notNull().default("CUTTING_IN_PROGRESS"),
    createdBy: integer("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("cutting_orders_status_idx").on(t.status),
    check("cutting_orders_target_qty_positive", sql`${t.targetQty} > 0`),
    check(
      "cutting_orders_actual_fabric_yds_positive",
      sql`${t.actualFabricYds} > 0`,
    ),
  ],
);

export const verificationItems = pgTable(
  "verification_items",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    orderId: integer("order_id")
      .notNull()
      .references(() => cuttingOrders.id, { onDelete: "cascade" }),
    componentId: integer("component_id")
      .notNull()
      .references(() => recipeComponents.id),
    expectedQty: integer("expected_qty").notNull(),
    // NULL until the verifier has counted this component.
    actualQty: integer("actual_qty"),
    status: itemStatus(),
  },
  (t) => [
    unique("verification_items_order_component_unique").on(
      t.orderId,
      t.componentId,
    ),
    check("verification_items_expected_qty_positive", sql`${t.expectedQty} > 0`),
    check(
      "verification_items_actual_qty_non_negative",
      sql`${t.actualQty} >= 0`,
    ),
    // The stored traffic light can never disagree with the stored counts.
    check(
      "verification_items_status_matches_counts",
      sql`(${t.actualQty} IS NULL AND ${t.status} IS NULL)
        OR (${t.actualQty} = ${t.expectedQty} AND ${t.status} = 'GREEN')
        OR (${t.actualQty} > ${t.expectedQty} AND ${t.status} = 'YELLOW')
        OR (${t.actualQty} < ${t.expectedQty} AND ${t.status} = 'RED')`,
    ),
  ],
);

export const verificationLogs = pgTable(
  "verification_logs",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    orderId: integer("order_id")
      .notNull()
      .references(() => cuttingOrders.id),
    verifierId: integer("verifier_id")
      .notNull()
      .references(() => users.id),
    decision: verificationDecision().notNull(),
    rejectionNote: text("rejection_note"),
    wastagePct: numeric("wastage_pct", {
      precision: 7,
      scale: 2,
      mode: "number",
    }).notNull(),
    timestamp: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("verification_logs_order_id_idx").on(t.orderId),
    // An order can be rejected many times but approved only once.
    uniqueIndex("verification_logs_one_approval_per_order")
      .on(t.orderId)
      .where(sql`${t.decision} = 'APPROVED'`),
    // COALESCE matters: a NULL note would otherwise make the check pass.
    check(
      "verification_logs_rejection_requires_note",
      sql`${t.decision} <> 'REJECTED' OR length(btrim(coalesce(${t.rejectionNote}, ''))) > 0`,
    ),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(cuttingOrders),
  verifications: many(verificationLogs),
}));

export const recipesRelations = relations(recipes, ({ many }) => ({
  components: many(recipeComponents),
  orders: many(cuttingOrders),
}));

export const recipeComponentsRelations = relations(
  recipeComponents,
  ({ one }) => ({
    recipe: one(recipes, {
      fields: [recipeComponents.recipeId],
      references: [recipes.id],
    }),
  }),
);

export const cuttingOrdersRelations = relations(
  cuttingOrders,
  ({ one, many }) => ({
    recipe: one(recipes, {
      fields: [cuttingOrders.recipeId],
      references: [recipes.id],
    }),
    creator: one(users, {
      fields: [cuttingOrders.createdBy],
      references: [users.id],
    }),
    items: many(verificationItems),
    logs: many(verificationLogs),
  }),
);

export const verificationItemsRelations = relations(
  verificationItems,
  ({ one }) => ({
    order: one(cuttingOrders, {
      fields: [verificationItems.orderId],
      references: [cuttingOrders.id],
    }),
    component: one(recipeComponents, {
      fields: [verificationItems.componentId],
      references: [recipeComponents.id],
    }),
  }),
);

export const verificationLogsRelations = relations(
  verificationLogs,
  ({ one }) => ({
    order: one(cuttingOrders, {
      fields: [verificationLogs.orderId],
      references: [cuttingOrders.id],
    }),
    verifier: one(users, {
      fields: [verificationLogs.verifierId],
      references: [users.id],
    }),
  }),
);
