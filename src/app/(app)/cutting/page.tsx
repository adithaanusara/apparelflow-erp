import { requirePageRole } from "@/server/auth/page-session";
import { getDb } from "@/server/db/client";
import { listOrders, listRecipes } from "@/server/orders/service";
import { filterFromParam } from "./order-filters";
import { OrdersDashboard } from "./orders-dashboard";

export default async function CuttingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  await requirePageRole("cutting_supervisor");
  const db = getDb();
  const [recipes, orders, { status }] = await Promise.all([
    listRecipes(db),
    listOrders(db),
    searchParams,
  ]);

  // The status in the URL only chooses which tab opens first. Every order on
  // this page is one the Cutting Supervisor is already allowed to see.
  return (
    <OrdersDashboard
      orders={orders}
      recipes={recipes}
      initialFilter={filterFromParam(status)}
    />
  );
}
