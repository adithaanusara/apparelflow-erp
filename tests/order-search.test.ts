import { describe, expect, it } from "vitest";
import { matchesOrderSearch } from "@/lib/order-search";

const fields = ["Casual Blouse", "REC-BL01", "Demo Cutting Supervisor"];
const matches = (query: string, orderNo = "CO-000012") => matchesOrderSearch(query, orderNo, fields);

describe("matchesOrderSearch", () => {
  it("matches everything for an empty or blank query", () => {
    expect(matches("")).toBe(true);
    expect(matches("   ")).toBe(true);
  });

  it.each(["CO-000012", "co-000012", "CO-0000", "000012", "12", " CO-000012 "])("finds the order number from %j", (query) => {
    expect(matches(query)).toBe(true);
  });

  it.each(["CO-00012", "CO-012", "co-12", "CO 12", "co12"])("accepts the order number written with different padding: %j", (query) => {
    expect(matches(query)).toBe(true);
  });

  it("matches a differently padded number by value, not as a prefix", () => {
    expect(matches("CO-00001", "CO-000001")).toBe(true);
    expect(matches("co-1", "CO-000001")).toBe(true);
    expect(matches("co-1", "CO-000100")).toBe(false);
    expect(matches("co-1", "CO-000012")).toBe(false);
  });

  it("still matches while the real order number is being typed", () => {
    // "CO-00001" is the start of "CO-000012" as well as another way to write order 1.
    expect(matches("CO-00001", "CO-000012")).toBe(true);
    expect(matches("CO-00002", "CO-000012")).toBe(false);
  });

  it.each(["blouse", "CASUAL", "rec-bl", "supervisor", "demo cutting"])("matches product and supervisor text: %j", (query) => {
    expect(matches(query)).toBe(true);
  });

  it.each(["crop top", "verifier", "CO-000013", "xyz"])("rejects %j", (query) => {
    expect(matches(query)).toBe(false);
  });
});
