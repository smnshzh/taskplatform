import { describe, expect, it } from "vitest";
import { getTaskSearchQuery } from "@/features/tasks/server/task-filter";

describe("task search query", () => {
  it("normalizes whitespace before applying server-side search", () => {
    const params = new URLSearchParams({ q: "  گزارش   فروش  " });
    expect(getTaskSearchQuery(params)).toBe("گزارش فروش");
  });

  it("limits excessively long search input", () => {
    const params = new URLSearchParams({ q: "x".repeat(150) });
    expect(getTaskSearchQuery(params)).toHaveLength(100);
  });
});
