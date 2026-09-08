import { describe, expect, it } from "vitest";
import { getMultiValueFilter } from "@/features/tasks/server/task-filter";

describe("task multi-value filters", () => {
  it("supports repeated and comma-separated values without duplicates", () => {
    const params = new URLSearchParams(
      "status=PENDING&status=STARTED%2CBLOCKED&status=PENDING"
    );

    expect(getMultiValueFilter(params, "status")).toEqual([
      "PENDING",
      "STARTED",
      "BLOCKED",
    ]);
  });
});
