import { describe, expect, it } from "vitest";
import { dayBounds, timeZoneOffsetMs, wallClockInZone, ymdInZone, zonedMidnight, zonedTimeToUtc } from "./time";

describe("time zone helpers", () => {
  it("computes fixed offsets", () => {
    const d = new Date("2026-11-15T12:00:00Z");
    expect(timeZoneOffsetMs(d, "UTC")).toBe(0);
    expect(timeZoneOffsetMs(d, "Asia/Karachi")).toBe(5 * 3600_000);
    expect(timeZoneOffsetMs(d, "America/New_York")).toBe(-5 * 3600_000);
  });

  it("finds the local calendar day", () => {
    // 20:00 UTC is already the next day in Karachi (UTC+5).
    expect(ymdInZone(new Date("2026-11-15T20:00:00Z"), "Asia/Karachi")).toBe("2026-11-16");
  });

  it("returns local midnight as a UTC instant", () => {
    expect(zonedMidnight("2026-11-16", "Asia/Karachi").toISOString()).toBe("2026-11-15T19:00:00.000Z");
  });

  it("converts wall-clock times both ways", () => {
    const instant = zonedTimeToUtc({ year: 2026, month: 11, day: 20, hour: 15, minute: 30 }, "Asia/Karachi");
    expect(instant.toISOString()).toBe("2026-11-20T10:30:00.000Z");
    expect(wallClockInZone(instant, "Asia/Karachi")).toEqual({ year: 2026, month: 11, day: 20, hour: 15, minute: 30 });
    expect(wallClockInZone(instant, "UTC").hour).toBe(10);
  });

  it("spans exactly one local day, including across a DST change", () => {
    const { start, end } = dayBounds(new Date("2026-11-15T20:00:00Z"), "Asia/Karachi");
    expect(start.toISOString()).toBe("2026-11-15T19:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-16T19:00:00.000Z");

    // US DST ends on 1 Nov 2026: that local day is 25 hours long.
    const dst = dayBounds(new Date("2026-11-01T15:00:00Z"), "America/New_York");
    expect(dst.start.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(dst.end.toISOString()).toBe("2026-11-02T05:00:00.000Z");
  });
});
