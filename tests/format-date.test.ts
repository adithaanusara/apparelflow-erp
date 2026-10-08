import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "@/lib/format-date";

describe("formatDateTime", () => {
  it("shows Sri Lanka time, five and a half hours ahead of UTC, on a 12-hour clock", () => {
    expect(formatDateTime("2026-10-08T01:37:00.000Z")).toBe("8 Oct 2026, 07:07 AM");
  });

  it.each([
    ["2026-10-08T06:29:00Z", "8 Oct 2026, 11:59 AM"],
    ["2026-10-08T06:30:00Z", "8 Oct 2026, 12:00 PM"],
    ["2026-10-08T07:35:00Z", "8 Oct 2026, 01:05 PM"],
    ["2026-10-08T18:29:59Z", "8 Oct 2026, 11:59 PM"],
  ])("formats %s as %s", (iso, expected) => {
    expect(formatDateTime(iso)).toBe(expected);
  });

  it("rolls over to the next day at midnight in Sri Lanka, not midnight UTC", () => {
    expect(formatDateTime("2026-10-08T18:30:00Z")).toBe("9 Oct 2026, 12:00 AM");
    expect(formatDateTime("2026-12-31T20:15:00Z")).toBe("1 Jan 2027, 01:45 AM");
  });

  it("does not depend on the time zone of the machine it runs on", () => {
    const original = process.env.TZ;
    try {
      for (const zone of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
        process.env.TZ = zone;
        expect(formatDateTime("2026-10-08T01:37:00Z")).toBe("8 Oct 2026, 07:07 AM");
      }
    } finally {
      process.env.TZ = original;
    }
  });
});

describe("formatDate", () => {
  it("uses the Sri Lanka calendar day", () => {
    expect(formatDate("2026-10-08T01:37:00Z")).toBe("8 Oct 2026");
    expect(formatDate("2026-10-08T19:00:00Z")).toBe("9 Oct 2026");
  });

  it("writes every month the same short way", () => {
    expect(Array.from({ length: 12 }, (_, month) => formatDate(new Date(Date.UTC(2026, month, 15, 6)).toISOString()))).toEqual(
      ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((name) => `15 ${name} 2026`),
    );
  });
});
