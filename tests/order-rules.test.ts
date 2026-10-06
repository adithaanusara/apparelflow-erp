import { describe, expect, it } from "vitest";
import {
  canTransition,
  expectedComponentQty,
  expectedFabricYards,
  formatOrderNo,
  statusesThatCanBecome,
  wastagePct,
} from "@/lib/order-rules";

describe("multiplier engine", () => {
  it("multiplies the batch quantity by pieces per garment", () => {
    expect(expectedComponentQty(50, 2)).toBe(100);
    expect(expectedComponentQty(50, 1)).toBe(50);
  });

  it("derives expected fabric without floating point drift", () => {
    expect(expectedFabricYards(50, 1.8)).toBe(90);
    expect(expectedFabricYards(3, 1.1)).toBe(3.3);
  });
});

describe("fabric wastage", () => {
  it("is the variance from expected fabric as a percentage", () => {
    expect(wastagePct(94.5, 90)).toBe(5);
    expect(wastagePct(90, 90)).toBe(0);
    expect(wastagePct(100, 90)).toBe(11.11);
  });

  it("is negative when less fabric was used than the standard", () => {
    expect(wastagePct(81, 90)).toBe(-10);
  });
});

describe("state machine", () => {
  it("allows only the documented transitions", () => {
    expect(canTransition("CUTTING_IN_PROGRESS", "PENDING_VERIFICATION")).toBe(true);
    expect(canTransition("PENDING_VERIFICATION", "VERIFIED")).toBe(true);
    expect(canTransition("PENDING_VERIFICATION", "REJECTED")).toBe(true);
    expect(canTransition("REJECTED", "PENDING_VERIFICATION")).toBe(true);
  });

  it("never lets an order skip verification or leave VERIFIED", () => {
    expect(canTransition("CUTTING_IN_PROGRESS", "VERIFIED")).toBe(false);
    expect(canTransition("REJECTED", "VERIFIED")).toBe(false);
    expect(statusesThatCanBecome("VERIFIED")).toEqual(["PENDING_VERIFICATION"]);
    expect(statusesThatCanBecome("CUTTING_IN_PROGRESS")).toEqual([]);
    expect(canTransition("VERIFIED", "PENDING_VERIFICATION")).toBe(false);
  });
});

describe("order numbers", () => {
  it("are zero-padded from the order id", () => {
    expect(formatOrderNo(42)).toBe("CO-000042");
  });
});
