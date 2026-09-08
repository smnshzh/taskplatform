import { describe, expect, it } from "vitest";
import { tehranCalendarDaysBetween, tehranDayRange, tehranLocalDateTimeToUtc } from "@/shared/lib/date/tehran-time";

describe("tehranDayRange", () => {
  it("uses Tehran midnight across UTC day boundaries", () => {
    const range = tehranDayRange(new Date("2026-08-02T22:00:00.000Z"));
    expect(range.start.toISOString()).toBe("2026-08-02T20:30:00.000Z");
    expect(range.end.toISOString()).toBe("2026-08-03T20:30:00.000Z");
  });
});

describe("tehranLocalDateTimeToUtc", () => {
  it("stores a Tehran wall-clock time as UTC", () => {
    expect(tehranLocalDateTimeToUtc(2026, 8, 11, 14, 30).toISOString())
      .toBe("2026-08-11T11:00:00.000Z");
  });
});

describe("tehranCalendarDaysBetween", () => {
  it("counts crossed Tehran calendar days across a UTC boundary", () => {
    expect(tehranCalendarDaysBetween(
      new Date("2026-08-02T20:29:00.000Z"),
      new Date("2026-08-02T20:31:00.000Z"),
    )).toBe(1);
  });
});
