import { describe, expect, it } from "vitest";
import { elapsedDaysSinceStart } from "@/features/tasks/elapsed-days";

describe("elapsed days since a task started", () => {
  const now = new Date("2026-08-19T12:00:00.000Z");

  it("returns full elapsed 24-hour days", () => {
    expect(elapsedDaysSinceStart("2026-08-16T11:59:59.000Z", now)).toBe(3);
  });

  it("returns zero during the first day", () => {
    expect(elapsedDaysSinceStart("2026-08-19T06:00:00.000Z", now)).toBe(0);
  });

  it("does not invent a duration when start time is missing", () => {
    expect(elapsedDaysSinceStart(null, now)).toBeNull();
  });
});
