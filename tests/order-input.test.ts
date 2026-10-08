import { describe, expect, it } from "vitest";
import { numberFromText, validateCreateOrder } from "@/lib/order-input";

const valid = {
  recipeId: 1,
  targetQty: 50,
  fabricRollId: "FAB-ROLL-882",
  actualFabricYds: 92.5,
};

function errorsFor(overrides: Record<string, unknown>) {
  const result = validateCreateOrder({ ...valid, ...overrides });
  return result.ok ? {} : result.errors;
}

describe("validateCreateOrder", () => {
  it("accepts a valid order and normalizes the roll id", () => {
    const result = validateCreateOrder({ ...valid, fabricRollId: " fab-roll-882 " });
    expect(result).toEqual({ ok: true, value: valid });
  });

  it("reports every missing field of an empty payload", () => {
    const result = validateCreateOrder({});
    expect(result.ok).toBe(false);
    expect(Object.keys(result.ok ? {} : result.errors).sort()).toEqual([
      "actualFabricYds",
      "fabricRollId",
      "recipeId",
      "targetQty",
    ]);
  });

  it.each([
    ["negative", -5],
    ["zero", 0],
    ["decimal", 12.5],
    ["numeric string", "50"],
    ["non-numeric string", "abc"],
    ["empty string", ""],
    ["null", null],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["boolean", true],
    ["above the limit", 100_001],
  ])("rejects a %s target quantity", (_label, targetQty) => {
    expect(errorsFor({ targetQty }).targetQty).toBeTruthy();
  });

  it.each([
    ["negative", -1],
    ["zero", 0],
    ["three decimals", 1.234],
    ["string", "92.5"],
    ["empty string", ""],
    ["NaN", Number.NaN],
  ])("rejects %s fabric yards", (_label, actualFabricYds) => {
    expect(errorsFor({ actualFabricYds }).actualFabricYds).toBeTruthy();
  });

  it.each(["", "   ", "FAB ROLL", "FAB--1", "-FAB", "<script>", "A".repeat(41), 882])(
    "rejects fabric roll id %j",
    (fabricRollId) => {
      expect(errorsFor({ fabricRollId }).fabricRollId).toBeTruthy();
    },
  );

  it.each([0, -1, 1.5, "1", null])("rejects recipe id %j", (recipeId) => {
    expect(errorsFor({ recipeId }).recipeId).toBeTruthy();
  });
});

describe("numberFromText", () => {
  it("converts plain decimal notation only", () => {
    expect(numberFromText(" 50 ")).toBe(50);
    expect(numberFromText("92.5")).toBe(92.5);
    expect(numberFromText("-5")).toBe(-5);
  });

  it.each(["", "abc", "1e3", "0x10", "5.", ".5", "1,000", "５０"])(
    "leaves %j as text so validation rejects it",
    (text) => {
      expect(typeof numberFromText(text)).toBe("string");
    },
  );
});
