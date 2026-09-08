import { db } from "../src/lib/db";
import { hashPassword } from "../src/features/auth/server/password";

async function main() {
  console.log("Seeding TaskManager database...");

  const initialPassword = process.env.SEED_INITIAL_PASSWORD;
  if (!initialPassword || initialPassword.length < 12) {
    throw new Error("SEED_INITIAL_PASSWORD with at least 12 characters is required");
  }
  const passwordHash = await hashPassword(initialPassword);

  await db.loginAttempt.deleteMany();
  await db.session.deleteMany();
  await db.auditLog.deleteMany();
  await db.followUpLog.deleteMany();
  await db.task.deleteMany();
  await db.taskSchedule.deleteMany();
  await db.taskTemplate.deleteMany();
  await db.member.deleteMany();
  await db.orgGroup.deleteMany();
  await db.company.deleteMany();
  await db.solution.deleteMany();

  const solutionTaskplatform = await db.solution.create({
    data: {
      key: "taskplatform",
      name: "TaskPlatform",
      description: "Task execution, approvals, scheduling, and team workflows.",
    },
  });
  await db.solution.createMany({
    data: [
      {
        key: "insight",
        name: "Insight",
        description: "Analytics and reporting workspace.",
      },
      {
        key: "workflows",
        name: "Workflows",
        description: "Cross-team process automation workspace.",
      },
    ],
  });

  const company = await db.company.create({
    data: {
      name: "TaskManager Internal",
      slug: "taskmanager-internal",
      selectedSolutionKey: solutionTaskplatform.key,
    },
  });

  // ---- Groups ----
  const grp1 = await db.orgGroup.create({ data: { name: "تأمین فانتزی", code: "GRP-001", companyId: company.id } });
  const grp2 = await db.orgGroup.create({ data: { name: "تأمین غیرفانتزی", code: "GRP-002", companyId: company.id } });
  const grp3 = await db.orgGroup.create({ data: { name: "هوش تجاری", code: "GRP-003", companyId: company.id } });
  const grp4 = await db.orgGroup.create({ data: { name: "پورسانت و گزارش‌ها", code: "GRP-004", companyId: company.id } });

  // ---- Super Admin ----
  await db.member.create({
    data: { name: "مدیر کل سیستم", handle: "@admin", password: passwordHash, role: "SUPER_ADMIN", companyId: company.id },
  });

  // ---- Managers ----
  const mgr1 = await db.member.create({
    data: { name: "مهندس رضایی", handle: "@mgr1", password: passwordHash, role: "MANAGER", companyId: company.id, groupId: grp1.id },
  });
  await db.groupManager.create({ data: { groupId: grp1.id, memberId: mgr1.id } });

  const mgr2 = await db.member.create({
    data: { name: "مهندس احمدی", handle: "@mgr2", password: passwordHash, role: "MANAGER", companyId: company.id, groupId: grp2.id },
  });
  await db.groupManager.create({ data: { groupId: grp2.id, memberId: mgr2.id } });

  const mgr3 = await db.member.create({
    data: { name: "مهندس نوری", handle: "@mgr3", password: passwordHash, role: "MANAGER", companyId: company.id, groupId: grp3.id },
  });
  await db.groupManager.create({ data: { groupId: grp3.id, memberId: mgr3.id } });

  const mgr4 = await db.member.create({
    data: { name: "مهندس موسوی", handle: "@mgr4", password: passwordHash, role: "MANAGER", companyId: company.id, groupId: grp4.id },
  });
  await db.groupManager.create({ data: { groupId: grp4.id, memberId: mgr4.id } });

  // ---- Supervisors ----
  const sup1 = await db.member.create({
    data: { name: "سرپرست علی‌پور", handle: "@sup1", password: passwordHash, role: "SUPERVISOR", companyId: company.id, groupId: grp1.id, supervisorId: mgr1.id },
  });
  const sup2 = await db.member.create({
    data: { name: "سرپرست کریمی", handle: "@sup2", password: passwordHash, role: "SUPERVISOR", companyId: company.id, groupId: grp2.id, supervisorId: mgr2.id },
  });

  // ---- Specialists ----
  const sp1 = await db.member.create({
    data: { name: "علی محمدی", handle: "@ali", password: passwordHash, role: "SPECIALIST", companyId: company.id, groupId: grp1.id, supervisorId: sup1.id },
  });
  const sp2 = await db.member.create({
    data: { name: "سارا رحیمی", handle: "@sara", password: passwordHash, role: "SPECIALIST", companyId: company.id, groupId: grp1.id, supervisorId: sup1.id },
  });
  const sp3 = await db.member.create({
    data: { name: "حسین حسینی", handle: "@hossein", password: passwordHash, role: "SPECIALIST", companyId: company.id, groupId: grp2.id, supervisorId: sup2.id },
  });
  const sp4 = await db.member.create({
    data: { name: "مریم نوری", handle: "@maryam", password: passwordHash, role: "SPECIALIST", companyId: company.id, groupId: grp2.id, supervisorId: sup2.id },
  });
  const sp5 = await db.member.create({
    data: { name: "رضا قاسمی", handle: "@reza", password: passwordHash, role: "SPECIALIST", companyId: company.id, groupId: grp3.id, supervisorId: mgr3.id },
  });
  const sp6 = await db.member.create({
    data: { name: "فاطمه موسوی", handle: "@fateme", password: passwordHash, role: "SPECIALIST", companyId: company.id, groupId: grp3.id, supervisorId: mgr3.id },
  });
  const sp7 = await db.member.create({
    data: { name: "امیر تهرانی", handle: "@amir", password: passwordHash, role: "SPECIALIST", companyId: company.id, groupId: grp4.id, supervisorId: mgr4.id },
  });
  const sp8 = await db.member.create({
    data: { name: "زهرا شریفی", handle: "@zahra", password: passwordHash, role: "SPECIALIST", companyId: company.id, groupId: grp4.id, supervisorId: mgr4.id },
  });

  // ---- Task Templates ----
  const tpl1 = await db.taskTemplate.create({ data: { name: "بررسی سفارشات ورودی", companyId: company.id, groupId: grp1.id, priority: "HIGH" } });
  const tpl2 = await db.taskTemplate.create({ data: { name: "تماس با تأمین‌کنندگان", companyId: company.id, groupId: grp1.id, priority: "MEDIUM" } });
  const tpl3 = await db.taskTemplate.create({ data: { name: "بررسی موجودی انبار", companyId: company.id, groupId: grp2.id, priority: "HIGH" } });
  const tpl4 = await db.taskTemplate.create({ data: { name: "تحلیل گزارش فروش", companyId: company.id, groupId: grp3.id, priority: "HIGH" } });
  const tpl5 = await db.taskTemplate.create({ data: { name: "محاسبه پورسانت", companyId: company.id, groupId: grp4.id, priority: "MEDIUM" } });

  // ---- Schedules ----
  await db.taskSchedule.createMany({
    data: [
      { taskTemplateId: tpl1.id, companyId: company.id, dayOfWeek: 0, startTime: "08:00", endTime: "10:00", assigneeId: sp1.id },
      { taskTemplateId: tpl1.id, companyId: company.id, dayOfWeek: 2, startTime: "08:00", endTime: "10:00", assigneeId: sp1.id },
      { taskTemplateId: tpl1.id, companyId: company.id, dayOfWeek: 4, startTime: "08:00", endTime: "10:00", assigneeId: sp2.id },
      { taskTemplateId: tpl2.id, companyId: company.id, dayOfWeek: 1, startTime: "10:00", endTime: "12:00", assigneeId: sp1.id },
      { taskTemplateId: tpl2.id, companyId: company.id, dayOfWeek: 3, startTime: "10:00", endTime: "12:00", assigneeId: sp2.id },
      { taskTemplateId: tpl3.id, companyId: company.id, dayOfWeek: 0, startTime: "09:00", endTime: "11:00", assigneeId: sp3.id },
      { taskTemplateId: tpl3.id, companyId: company.id, dayOfWeek: 2, startTime: "09:00", endTime: "11:00", assigneeId: sp4.id },
      { taskTemplateId: tpl3.id, companyId: company.id, dayOfWeek: 4, startTime: "09:00", endTime: "11:00", assigneeId: sp3.id },
      { taskTemplateId: tpl4.id, companyId: company.id, dayOfWeek: 1, startTime: "08:00", endTime: "11:00", assigneeId: sp5.id },
      { taskTemplateId: tpl4.id, companyId: company.id, dayOfWeek: 3, startTime: "08:00", endTime: "11:00", assigneeId: sp6.id },
      { taskTemplateId: tpl5.id, companyId: company.id, dayOfWeek: 5, startTime: "08:00", endTime: "12:00", assigneeId: sp7.id },
    ],
  });

  // ---- Sample Tasks ----
  const now = new Date();
  const dayMs = 86400000;
  const hourMs = 3600000;
    let counter = 1;

  type SampleTask = {
    title: string; groupId: string; assigneeId: string; priority: string;
    status: string; deadlineDays: number; deadlineHour: number; source: string;
    followUpReason?: string; letterNumber?: string; letterDate?: string;
    refererId?: string; approvalStatus?: string; approverId?: string;
  };

  const sampleTasks: SampleTask[] = [
    { title: "تأمین کالکشن فانتزی پاییز", groupId: grp1.id, assigneeId: sp1.id, priority: "HIGH", status: "STARTED", deadlineDays: 0, deadlineHour: 18, source: "MANUAL" },
    { title: "بررسی کیفیت محصولات ورودی", groupId: grp1.id, assigneeId: sp2.id, priority: "MEDIUM", status: "PENDING", deadlineDays: 2, deadlineHour: 16, source: "MANUAL" },
    { title: "سفارش انبار هفتگی", groupId: grp2.id, assigneeId: sp3.id, priority: "HIGH", status: "BLOCKED", deadlineDays: -1, deadlineHour: 12, source: "MANUAL", followUpReason: "DEPENDENT_ON_OTHERS" },
    { title: "هماهنگی حمل‌ونقل", groupId: grp2.id, assigneeId: sp4.id, priority: "MEDIUM", status: "STARTED", deadlineDays: 1, deadlineHour: 17, source: "MANUAL" },
    { title: "داشبورد فروش هفتگی", groupId: grp3.id, assigneeId: sp5.id, priority: "HIGH", status: "STARTED", deadlineDays: 0, deadlineHour: 19, source: "MANUAL" },
    { title: "تحلیل ریزش مشتریان", groupId: grp3.id, assigneeId: sp6.id, priority: "MEDIUM", status: "PENDING", deadlineDays: 3, deadlineHour: 16, source: "MANUAL" },
    { title: "محاسبه پورسانت نمایندگان", groupId: grp4.id, assigneeId: sp7.id, priority: "HIGH", status: "STARTED", deadlineDays: 0, deadlineHour: 20, source: "MANUAL" },
    { title: "تسویه حساب شعب", groupId: grp4.id, assigneeId: sp8.id, priority: "HIGH", status: "PENDING", deadlineDays: 1, deadlineHour: 14, source: "MANUAL" },
    { title: "پیگیری نامه شماره ۱۲۳۴", groupId: grp1.id, assigneeId: sp1.id, priority: "HIGH", status: "PENDING", deadlineDays: 2, deadlineHour: 16, source: "REFERRED", letterNumber: "1234", letterDate: "1405/04/01", refererId: sp1.id, approvalStatus: "APPROVED", approverId: sup1.id },
    { title: "ارجاع نامه معاونت بازرگانی", groupId: grp2.id, assigneeId: sp3.id, priority: "MEDIUM", status: "PENDING", deadlineDays: 5, deadlineHour: 12, source: "REFERRED", letterNumber: "5678", letterDate: "1405/04/02", refererId: sp3.id, approvalStatus: "PENDING_APPROVAL" },
  ];

  for (const t of sampleTasks) {
    const deadline = new Date(now.getTime() + t.deadlineDays * dayMs + (t.deadlineHour - now.getHours()) * hourMs);
    const created = new Date(now.getTime() - 5 * dayMs - Math.random() * 3 * dayMs);
    const sStartedAt = (t.status === "STARTED" || t.status === "DONE") ? new Date(created.getTime() + dayMs) : null;
    const sDoneAt = t.status === "DONE" ? new Date(now.getTime() - dayMs) : null;
    const sStartTime = new Date(Math.max(deadline.getTime() - 2 * dayMs, created.getTime()));

    const d: any = {
      code: `TSK-${String(counter).padStart(4, "0")}`,
      title: t.title,
      companyId: company.id,
      groupId: t.groupId,
      assignee: { connect: { id: t.assigneeId } },
      priority: t.priority,
      status: t.status,
      source: t.source,
      startTime: sStartTime,
      deadline,
      createdAt: created,
      updatedAt: sDoneAt ?? sStartedAt ?? created,
    };
    if (t.followUpReason) d.followUpReason = t.followUpReason;
    if (sStartedAt) d.startedAt = sStartedAt;
    if (sDoneAt) d.doneAt = sDoneAt;
    if (t.letterNumber) d.letterNumber = t.letterNumber;
    if (t.letterDate) d.letterDate = t.letterDate;
    if (t.approvalStatus) d.approvalStatus = t.approvalStatus;
    if (t.refererId) d.referer = { connect: { id: t.refererId } };
    if (t.approverId) {
      d.approver = { connect: { id: t.approverId } };
      d.approvedAt = new Date(now.getTime() - 2 * dayMs);
    }

    await db.task.create({ data: d });
    counter++;
  }

  console.log(`Seeded successfully:`);
  console.log(`  1 Super Admin, 4 Managers, 2 Supervisors, 8 Specialists`);
  console.log(`  4 Groups, 5 Task Templates, 11 Schedules, ${counter - 1} Tasks`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
