import { describe, expect, it } from "vitest";
import { getCurrentWorkflowLocation, isWorkflowClosed } from "@/features/tasks/workflow-status";

describe("workflow completion", () => {
  it("closes a workflow only after its final remaining task is done", () => {
    expect(isWorkflowClosed([{ status: "DONE" }, { status: "DONE" }])).toBe(true);
    expect(isWorkflowClosed([{ status: "DONE" }, { status: "STARTED" }])).toBe(false);
  });
});

describe("workflow current location", () => {
  it("selects the first unfinished level and prefers its started task", () => {
    const tasks = new Map([
      ["done", { status: "DONE", title: "ثبت" }],
      ["pending", { status: "PENDING", title: "بررسی" }],
      ["started", { status: "STARTED", title: "تأیید" }],
    ]);
    const current = getCurrentWorkflowLocation([["done"], ["pending", "started"]], tasks);
    expect(current.levelIndex).toBe(1);
    expect(current.task?.title).toBe("تأیید");
  });
});
