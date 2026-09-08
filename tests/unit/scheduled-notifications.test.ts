import { describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  notificationRule: { findMany: vi.fn() },
  task: { findMany: vi.fn() },
  taskRelation: { findMany: vi.fn() },
  member: { findMany: vi.fn() },
  notificationOutbox: { createMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { enqueueScheduledNotifications, overdueTasksDigest, startedTasksByMemberDigest, workflowDigest } from "@/features/notifications/server/scheduled-notifications.service";

describe("scheduled Bale notifications", () => {
  it("does not select blocked tasks for overdue reminders", async () => {
    dbMock.notificationRule.findMany.mockResolvedValueOnce([
      { id: "overdue-rule", eventType: "OVERDUE", sendTime: "09:00", recipientMode: "ASSIGNEE", leadMinutes: null },
    ]);
    dbMock.task.findMany.mockResolvedValueOnce([]);

    await enqueueScheduledNotifications(new Date("2026-08-15T05:30:00.000Z"));

    expect(dbMock.task.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: { in: ["PENDING", "STARTED"] },
      }),
    }));
  });
});

describe("scheduled Bale group reports", () => {
  it("builds all overdue tasks in one grouped message", () => {
    const text = overdueTasksDigest([
      { id: "task-1", code: "T-1", title: "پیگیری سفارش", deadline: new Date("2026-08-12T05:30:00.000Z"), status: "STARTED", group: { name: "فروش" }, assignee: { name: "علی" } },
      { id: "task-2", code: "T-2", title: "ثبت فاکتور", deadline: new Date("2026-08-14T05:30:00.000Z"), status: "PENDING", group: { name: "فروش" }, assignee: { name: "علی" } },
    ], new Date("2026-08-15T05:30:00.000Z"));
    expect(text).toContain("مجموع: ۲ تسک");
    expect(text).toContain("علی: ۲ تسک");
    expect(text).toContain("T-1 — پیگیری سفارش (۳ روز عقب‌افتاده)");
    expect(text).toContain("T-2 — ثبت فاکتور (۱ روز عقب‌افتاده)");
  });

  it("queues one overdue digest for the configured Bale group", async () => {
    dbMock.notificationRule.findMany.mockResolvedValueOnce([{
      id: "overdue-digest-rule", eventType: "GROUP_OVERDUE_REPORT", sendTime: "09:00", recipientMode: "BALE_GROUP", leadMinutes: null,
      baleGroupDestination: { id: "destination-1", chatId: "-100123", isEnabled: true, orgGroupId: "group-1" },
    }]);
    dbMock.task.findMany.mockResolvedValueOnce([
      { id: "task-1", code: "T-1", title: "پیگیری سفارش", deadline: new Date("2026-08-12T05:30:00.000Z"), status: "STARTED", group: { name: "فروش" }, assignee: { name: "علی" } },
    ]);
    dbMock.notificationOutbox.createMany.mockResolvedValueOnce({ count: 1 });
    await expect(enqueueScheduledNotifications(new Date("2026-08-15T05:30:00.000Z"))).resolves.toBe(1);
    expect(dbMock.task.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: { in: ["PENDING", "STARTED"] }, groupId: "group-1" }) }));
    expect(dbMock.notificationOutbox.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ eventType: "GROUP_OVERDUE_REPORT", aggregateType: "GroupOverdueReport" })], skipDuplicates: true }));
  });

  it("builds the started-task count and details for every member", () => {
    const text = startedTasksByMemberDigest([
      { id: "member-1", name: "علی", group: { name: "فروش" }, tasks: [{ code: "T-1", title: "پیگیری سفارش", startedAt: new Date("2026-08-12T05:30:00.000Z") }] },
      { id: "member-2", name: "مریم", group: { name: "فروش" }, tasks: [] },
    ], new Date("2026-08-15T05:30:00.000Z"));
    expect(text).toContain("مجموع: ۱ تسک");
    expect(text).toContain("علی: ۱ تسک");
    expect(text).toContain("T-1 — پیگیری سفارش");
    expect(text).toContain("۳ روز گذشته");
    expect(text).toContain("مریم: ۰ تسک");
  });

  it("keeps the started-task report inside a safe Bale message size", () => {
    const text = startedTasksByMemberDigest(Array.from({ length: 50 }, (_, index) => ({
      id: `member-${index}`,
      name: `عضو ${index}`,
      group: { name: "فروش" },
      tasks: Array.from({ length: 6 }, (__, taskIndex) => ({ code: `T-${index}-${taskIndex}`, title: "عنوان بسیار طولانی تسک برای کنترل سقف پیام", startedAt: null })),
    })));
    expect(text?.length).toBeLessThanOrEqual(3800);
    expect(text).toContain("ادامه گزارش در پنل مدیریت");
  });

  it("queues the started-task report once for the configured Bale group", async () => {
    dbMock.notificationRule.findMany.mockResolvedValueOnce([{
      id: "started-rule", eventType: "GROUP_STARTED_REPORT", sendTime: "09:00", recipientMode: "BALE_GROUP", leadMinutes: null,
      baleGroupDestination: { id: "destination-1", chatId: "-100123", isEnabled: true, orgGroupId: "group-1" },
    }]);
    dbMock.member.findMany.mockResolvedValueOnce([
      { id: "member-1", name: "علی", group: { name: "فروش" }, tasks: [{ code: "T-1", title: "پیگیری سفارش", startedAt: new Date("2026-08-12T05:30:00.000Z") }] },
    ]);
    dbMock.notificationOutbox.createMany.mockResolvedValueOnce({ count: 1 });

    await expect(enqueueScheduledNotifications(new Date("2026-08-15T05:30:00.000Z"))).resolves.toBe(1);
    expect(dbMock.member.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { isActive: true, groupId: "group-1" },
    }));
    expect(dbMock.notificationOutbox.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({
        eventType: "GROUP_STARTED_REPORT",
        aggregateType: "GroupStartedReport",
        recipientId: "-100123",
        idempotencyKey: expect.stringContaining("2026-08-15"),
      })],
      skipDuplicates: true,
    }));
  });

  it("builds separate open and closed workflow digests", () => {
    const relations = [{
      id: "rel-1",
      workflowName: "درخواست خرید",
      previousTask: { id: "task-1", code: "T-1", title: "ثبت", status: "DONE", group: { name: "فروش" } },
      nextTask: { id: "task-2", code: "T-2", title: "تأیید", status: "STARTED", group: { name: "مالی" } },
    }];
    expect(workflowDigest("WORKFLOW_OPEN", relations)).toContain("مرحله جاری: T-2 · مالی");
    expect(workflowDigest("WORKFLOW_CLOSED", relations)).toBeNull();
  });

  it("queues a workflow digest directly for the configured Bale group", async () => {
    dbMock.notificationRule.findMany.mockResolvedValueOnce([{
      id: "workflow-rule", eventType: "WORKFLOW_OPEN", sendTime: "09:00", recipientMode: "BALE_GROUP", leadMinutes: null,
      baleGroupDestination: { id: "destination-1", chatId: "-100123", isEnabled: true, orgGroupId: null },
    }]);
    dbMock.taskRelation.findMany.mockResolvedValueOnce([{
      id: "rel-1", workflowName: "درخواست خرید",
      previousTask: { id: "task-1", code: "T-1", title: "ثبت", status: "DONE", group: { name: "فروش" } },
      nextTask: { id: "task-2", code: "T-2", title: "تأیید", status: "PENDING", group: { name: "مالی" } },
    }]);
    dbMock.notificationOutbox.createMany.mockResolvedValueOnce({ count: 1 });

    await expect(enqueueScheduledNotifications(new Date("2026-08-15T05:30:00.000Z"))).resolves.toBe(1);
    expect(dbMock.notificationOutbox.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ memberId: null, recipientId: "-100123", aggregateType: "WorkflowDigest" })],
      skipDuplicates: true,
    }));
  });
});
