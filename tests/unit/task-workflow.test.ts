import { describe, expect, it, vi } from "vitest";
import { connectWorkflowTasks, ensureWorkflowTaskReady } from "@/features/tasks/server/task-workflow.service";

describe("task workflow relations", () => {
  it("rejects linking a task to itself", async () => {
    await expect(connectWorkflowTasks({} as never, {
      previousTaskId: "task-1",
      nextTaskId: "task-1",
      createdById: "member-1",
    })).rejects.toThrow("خودش");
  });

  it("rejects a relation that closes a workflow cycle", async () => {
    const tx = {
      task: { findMany: vi.fn().mockResolvedValue([{ id: "a", groupId: "g" }, { id: "c", groupId: "g" }]) },
      taskRelation: {
        findMany: vi.fn().mockResolvedValue([
          { previousTaskId: "a", nextTaskId: "b" },
          { previousTaskId: "b", nextTaskId: "c" },
        ]),
        upsert: vi.fn(),
      },
    };
    await expect(connectWorkflowTasks(tx as never, {
      previousTaskId: "c",
      nextTaskId: "a",
      createdById: "member-1",
    })).rejects.toThrow("چرخه");
    expect(tx.taskRelation.upsert).not.toHaveBeenCalled();
  });

  it("allows handoff between tasks in different organization groups", async () => {
    const tx = {
      task: { findMany: vi.fn().mockResolvedValue([{ id: "a", groupId: "sales" }, { id: "b", groupId: "finance" }]) },
      taskRelation: {
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue({ id: "relation-1" }),
      },
    };
    await expect(connectWorkflowTasks(tx as never, {
      previousTaskId: "a",
      nextTaskId: "b",
      createdById: "member-1",
    })).resolves.toEqual({ id: "relation-1" });
  });

  it("blocks starting the next task until every prerequisite is done", async () => {
    const tx = { taskRelation: { findMany: vi.fn().mockResolvedValue([
      { previousTask: { status: "DONE" } },
      { previousTask: { status: "STARTED" } },
    ]) } };
    await expect(ensureWorkflowTaskReady(tx as never, "next-task")).rejects.toThrow("مرحله قبلی");
  });
});
