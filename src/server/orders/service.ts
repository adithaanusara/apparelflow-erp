import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { CreateOrderInput } from "../../lib/order-input";
import {
  expectedComponentQty,
  expectedFabricYards,
  formatOrderNo,
  statusesThatCanBecome,
  wastagePct,
  type OrderStatus,
} from "../../lib/order-rules";
import type { ItemStatus } from "../../lib/verification-rules";
import type { Database } from "../db/client";
import {
  cuttingOrders,
  recipeComponents,
  recipes,
  verificationItems,
  verificationLogs,
} from "../db/schema";
import { HttpError } from "../http";

export type RecipeWithComponents = {
  id: number;
  recipeCode: string;
  name: string;
  category: string;
  stdFabricYards: number;
  wastageCap: number;
  components: { id: number; componentName: string; piecesPerGarment: number }[];
};

export type OrderSummary = {
  id: number;
  orderNo: string;
  status: OrderStatus;
  targetQty: number;
  fabricRollId: string;
  actualFabricYds: number;
  expectedFabricYds: number;
  wastagePct: number;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  recipe: {
    id: number;
    recipeCode: string;
    name: string;
    wastageCap: number;
  };
  items: {
    componentId: number;
    componentName: string;
    piecesPerGarment: number;
    expectedQty: number;
    // NULL until the verifier has counted the component.
    actualQty: number | null;
    status: ItemStatus | null;
  }[];
  // The most recent rejection, kept so the supervisor can see why a batch
  // came back and the verifier can see what was wrong last time.
  latestRejection: { note: string; verifierName: string; at: string } | null;
};

// Wastage is stored as numeric(7,2). Refusing fabric beyond this multiple of
// the recipe standard keeps the percentage far inside that range and catches
// a mistyped yardage.
const MAX_FABRIC_MULTIPLE = 100;

export async function listRecipes(
  db: Database,
): Promise<RecipeWithComponents[]> {
  return db.query.recipes.findMany({
    orderBy: asc(recipes.recipeCode),
    with: {
      components: {
        columns: { id: true, componentName: true, piecesPerGarment: true },
        orderBy: asc(recipeComponents.id),
      },
    },
  });
}

// One query shape for every order read, so list and detail always agree.
function findOrders(
  db: Database,
  filter: {
    orderId?: number;
    status?: OrderStatus;
    oldestFirst?: boolean;
  } = {},
) {
  return db.query.cuttingOrders.findMany({
    where: and(
      filter.orderId === undefined
        ? undefined
        : eq(cuttingOrders.id, filter.orderId),
      filter.status === undefined
        ? undefined
        : eq(cuttingOrders.status, filter.status),
    ),
    orderBy: filter.oldestFirst
      ? asc(cuttingOrders.id)
      : desc(cuttingOrders.id),
    with: {
      recipe: true,
      creator: { columns: { fullName: true } },
      items: {
        orderBy: asc(verificationItems.componentId),
        with: { component: true },
      },
      logs: {
        where: eq(verificationLogs.decision, "REJECTED"),
        orderBy: desc(verificationLogs.id),
        limit: 1,
        with: { verifier: { columns: { fullName: true } } },
      },
    },
  });
}

function toOrderSummary(
  order: Awaited<ReturnType<typeof findOrders>>[number],
): OrderSummary {
  const expectedFabricYds = expectedFabricYards(
    order.targetQty,
    order.recipe.stdFabricYards,
  );
  const [rejection] = order.logs;
  return {
    id: order.id,
    orderNo: order.orderNo,
    status: order.status,
    targetQty: order.targetQty,
    fabricRollId: order.fabricRollId,
    actualFabricYds: order.actualFabricYds,
    expectedFabricYds,
    wastagePct: wastagePct(order.actualFabricYds, expectedFabricYds),
    createdByName: order.creator.fullName,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    recipe: {
      id: order.recipe.id,
      recipeCode: order.recipe.recipeCode,
      name: order.recipe.name,
      wastageCap: order.recipe.wastageCap,
    },
    items: order.items.map((item) => ({
      componentId: item.componentId,
      componentName: item.component.componentName,
      piecesPerGarment: item.component.piecesPerGarment,
      expectedQty: item.expectedQty,
      actualQty: item.actualQty,
      status: item.status,
    })),
    latestRejection: rejection
      ? {
          note: rejection.rejectionNote ?? "",
          verifierName: rejection.verifier.fullName,
          at: rejection.timestamp.toISOString(),
        }
      : null,
  };
}

export async function listOrders(
  db: Database,
  filter: { status?: OrderStatus; oldestFirst?: boolean } = {},
): Promise<OrderSummary[]> {
  return (await findOrders(db, filter)).map(toOrderSummary);
}

export async function findOrderSummary(
  db: Database,
  orderId: number,
): Promise<OrderSummary | undefined> {
  const [order] = await findOrders(db, { orderId });
  return order && toOrderSummary(order);
}

// Loads the recipe an order refers to and applies the rules that need it.
async function loadRecipeFor(tx: Database, input: CreateOrderInput) {
  const recipe = await tx.query.recipes.findFirst({
    where: eq(recipes.id, input.recipeId),
    with: { components: true },
  });
  if (!recipe) {
    throw new HttpError(422, "VALIDATION_FAILED", "The order is invalid.", {
      recipeId: "Select a valid recipe.",
    });
  }
  if (recipe.components.length === 0) {
    throw new HttpError(422, "VALIDATION_FAILED", "The order is invalid.", {
      recipeId: "This recipe has no components to cut.",
    });
  }

  const expectedFabricYds = expectedFabricYards(
    input.targetQty,
    recipe.stdFabricYards,
  );
  if (input.actualFabricYds > expectedFabricYds * MAX_FABRIC_MULTIPLE) {
    throw new HttpError(422, "VALIDATION_FAILED", "The order is invalid.", {
      actualFabricYds: `Fabric used cannot exceed ${MAX_FABRIC_MULTIPLE} times the ${expectedFabricYds} yd expected for this batch.`,
    });
  }
  return recipe;
}

// Multiplier engine: one uncounted checklist row per recipe component.
async function insertExpectedItems(
  tx: Database,
  orderId: number,
  targetQty: number,
  components: { id: number; piecesPerGarment: number }[],
) {
  await tx.insert(verificationItems).values(
    components.map((component) => ({
      orderId,
      componentId: component.id,
      expectedQty: expectedComponentQty(targetQty, component.piecesPerGarment),
    })),
  );
}

// Creates the order and its expected component counts in one transaction, so
// an order can never exist without its verification checklist. Expected
// counts are derived here from the recipe; the client never supplies them.
export async function createOrder(
  db: Database,
  input: CreateOrderInput,
  createdBy: number,
): Promise<OrderSummary> {
  return db.transaction(async (tx) => {
    const recipe = await loadRecipeFor(tx, input);

    // The order number is derived from the generated id, so it is unique
    // without a read-then-write race. The placeholder only lives inside this
    // transaction.
    const [{ id: orderId }] = await tx
      .insert(cuttingOrders)
      .values({
        orderNo: `PENDING-${randomUUID()}`,
        recipeId: recipe.id,
        targetQty: input.targetQty,
        fabricRollId: input.fabricRollId,
        actualFabricYds: input.actualFabricYds,
        createdBy,
      })
      .returning({ id: cuttingOrders.id });

    await tx
      .update(cuttingOrders)
      .set({ orderNo: formatOrderNo(orderId) })
      .where(eq(cuttingOrders.id, orderId));

    await insertExpectedItems(tx, orderId, input.targetQty, recipe.components);

    const [order] = await findOrders(tx, { orderId });
    return toOrderSummary(order);
  });
}

// Sends an order to the QC station. The status check is part of the UPDATE
// itself, so two simultaneous requests cannot both succeed and no request can
// move an order that is already pending or verified.
export async function submitOrderForVerification(
  db: Database,
  orderId: number,
): Promise<OrderSummary> {
  return db.transaction(async (tx) => {
    const moved = await tx
      .update(cuttingOrders)
      .set({ status: "PENDING_VERIFICATION", updatedAt: new Date() })
      .where(
        and(
          eq(cuttingOrders.id, orderId),
          inArray(
            cuttingOrders.status,
            statusesThatCanBecome("PENDING_VERIFICATION"),
          ),
        ),
      )
      .returning({ id: cuttingOrders.id });

    if (moved.length === 0) {
      const [existing] = await tx
        .select({ status: cuttingOrders.status })
        .from(cuttingOrders)
        .where(eq(cuttingOrders.id, orderId));
      if (!existing) {
        throw new HttpError(404, "NOT_FOUND", "Cutting order not found.");
      }
      throw new HttpError(
        409,
        "INVALID_TRANSITION",
        `An order with status ${existing.status} cannot be submitted for verification.`,
      );
    }

    // A re-cut batch must be counted from scratch: counts from the rejected
    // attempt do not carry over.
    await tx
      .update(verificationItems)
      .set({ actualQty: null, status: null })
      .where(eq(verificationItems.orderId, orderId));

    const [order] = await findOrders(tx, { orderId });
    return toOrderSummary(order);
  });
}
