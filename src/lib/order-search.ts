// Free-text search over orders, shared by the order dashboard and the
// Verifier workspace.

// True when `query` matches the order number or any of the other fields.
// Matching ignores case. Order numbers are padded ("CO-000001"), so a query
// written with a different number of zeros ("CO-00001", "co-1") still finds
// the order it names.
export function matchesOrderSearch(
  query: string,
  orderNo: string,
  fields: readonly string[],
): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;

  if (
    [orderNo, ...fields].some((text) => text.toLowerCase().includes(needle))
  ) {
    return true;
  }

  const asOrderNo = /^co[-\s]?0*(\d+)$/.exec(needle);
  return asOrderNo !== null && asOrderNo[1] === String(orderNumberOf(orderNo));
}

// The number in an order number: "CO-000042" is 42.
function orderNumberOf(orderNo: string): number {
  return Number(orderNo.replace(/\D/g, ""));
}
