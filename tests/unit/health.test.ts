import { describe, expect, it } from "vitest";
import { createHealthResponse, HEALTH_STATUS } from "@/shared/lib/health";

describe("health response", () => {
  it("returns a stable service identity and ISO timestamp", () => {
    const now = new Date("2026-07-20T12:00:00.000Z");

    expect(createHealthResponse(now)).toEqual({
      ...HEALTH_STATUS,
      timestamp: "2026-07-20T12:00:00.000Z",
    });
  });
});
