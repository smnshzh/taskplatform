/**
 * Migrate data from SQLite to PostgreSQL
 *
 * Usage:
 *   1. Make sure .env points to PostgreSQL
 *   2. Run: npx tsx scripts/migrate-sqlite-to-pg.ts <path-to-sqlite-db>
 *
 * Example:
 *   npx tsx scripts/migrate-sqlite-to-pg.ts "D:/clone/taskmanager/db/custom.db"
 */

import Database from "better-sqlite3";
import { PrismaClient } from "@prisma/client";

const pg = new PrismaClient();

function parseSQLiteDate(val: string | number | null | undefined): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  const sqlitePath = process.argv[2];
  if (!sqlitePath) {
    console.error("Usage: npx tsx scripts/migrate-sqlite-to-pg.ts <sqlite-db-path>");
    process.exit(1);
  }

  console.log(`Reading from SQLite: ${sqlitePath}`);
  const sqlite = new Database(sqlitePath, { readonly: true });

  // ---- Clear PG ----
  console.log("Clearing PostgreSQL tables...");
  await pg.followUpLog.deleteMany();
  await pg.task.deleteMany();
  await pg.taskSchedule.deleteMany();
  await pg.taskTemplate.deleteMany();
  await pg.groupManager.deleteMany();
  await pg.member.deleteMany();
  await pg.orgGroup.deleteMany();

  // ---- Migrate OrgGroups ----
  console.log("Migrating OrgGroups...");
  const groups = sqlite.prepare("SELECT * FROM OrgGroup").all() as any[];

  for (const g of groups) {
    await pg.orgGroup.create({
      data: {
        id: g.id,
        name: g.name,
        code: g.code,
        createdAt: parseSQLiteDate(g.createdAt) ?? new Date(),
      },
    });
  }
  console.log(`  -> ${groups.length} groups`);

  // ---- Migrate Members ----
  console.log("Migrating Members...");
  const members = sqlite.prepare("SELECT * FROM Member").all() as any[];

  for (const m of members) {
    await pg.member.create({
      data: {
        id: m.id,
        name: m.name,
        handle: m.handle,
        password: m.password,
        role: m.role,
        groupId: m.groupId || null,
        supervisorId: m.supervisorId || null,
        avatar: m.avatar || null,
        createdAt: parseSQLiteDate(m.createdAt) ?? new Date(),
        lastLoginAt: parseSQLiteDate(m.lastLoginAt),
      },
    });
  }
  console.log(`  -> ${members.length} members`);

  // ---- Migrate GroupManagers ----
  console.log("Migrating GroupManagers...");
  const gms = sqlite.prepare("SELECT * FROM GroupManager").all() as any[];

  for (const gm of gms) {
    await pg.groupManager.create({
      data: {
        id: gm.id,
        groupId: gm.groupId,
        memberId: gm.memberId,
        createdAt: parseSQLiteDate(gm.createdAt) ?? new Date(),
      },
    });
  }
  console.log(`  -> ${gms.length} group managers`);

  // ---- Migrate TaskTemplates ----
  console.log("Migrating TaskTemplates...");
  const templates = sqlite.prepare("SELECT * FROM TaskTemplate").all() as any[];

  for (const t of templates) {
    await pg.taskTemplate.create({
      data: {
        id: t.id,
        name: t.name,
        description: t.description || null,
        groupId: t.groupId,
        priority: t.priority || "MEDIUM",
        createdAt: parseSQLiteDate(t.createdAt) ?? new Date(),
      },
    });
  }
  console.log(`  -> ${templates.length} templates`);

  // ---- Migrate TaskSchedules ----
  console.log("Migrating TaskSchedules...");
  const schedules = sqlite.prepare("SELECT * FROM TaskSchedule").all() as any[];

  for (const s of schedules) {
    await pg.taskSchedule.create({
      data: {
        id: s.id,
        taskTemplateId: s.taskTemplateId,
        dayOfWeek: s.dayOfWeek ?? null,
        specificDate: s.specificDate || null,
        startTime: s.startTime,
        endTime: s.endTime,
        assigneeId: s.assigneeId,
        overrideAssigneeId: s.overrideAssigneeId || null,
        overrideDate: s.overrideDate || null,
        createdAt: parseSQLiteDate(s.createdAt) ?? new Date(),
      },
    });
  }
  console.log(`  -> ${schedules.length} schedules`);

  // ---- Migrate Tasks ----
  console.log("Migrating Tasks...");
  const tasks = sqlite.prepare("SELECT * FROM Task").all() as any[];

  for (const t of tasks) {
    await pg.task.create({
      data: {
        id: t.id,
        code: t.code,
        title: t.title,
        description: t.description || null,
        groupId: t.groupId,
        source: t.source || "MANUAL",
        assigneeId: t.assigneeId,
        priority: t.priority || "MEDIUM",
        status: t.status || "PENDING",
        letterNumber: t.letterNumber || null,
        letterDate: t.letterDate || null,
        refererId: t.refererId || null,
        approvalStatus: t.approvalStatus || null,
        approverId: t.approverId || null,
        approvedAt: parseSQLiteDate(t.approvedAt),
        startTime: parseSQLiteDate(t.startTime),
        deadline: parseSQLiteDate(t.deadline) ?? new Date(),
        link: t.link || null,
        followUpReason: t.followUpReason || null,
        startedAt: parseSQLiteDate(t.startedAt),
        doneDescription: t.doneDescription || null,
        doneAt: parseSQLiteDate(t.doneAt),
        createdAt: parseSQLiteDate(t.createdAt) ?? new Date(),
        updatedAt: parseSQLiteDate(t.updatedAt) ?? new Date(),
      },
    });
  }
  console.log(`  -> ${tasks.length} tasks`);

  // ---- Migrate FollowUpLogs ----
  console.log("Migrating FollowUpLogs...");
  const logs = sqlite.prepare("SELECT * FROM FollowUpLog").all() as any[];

  for (const l of logs) {
    await pg.followUpLog.create({
      data: {
        id: l.id,
        taskId: l.taskId,
        type: l.type,
        message: l.message,
        reason: l.reason || null,
        createdAt: parseSQLiteDate(l.createdAt) ?? new Date(),
      },
    });
  }
  console.log(`  -> ${logs.length} logs`);

  sqlite.close();
  await pg.$disconnect();

  console.log("\nMigration complete!");
  console.log(`  Groups: ${groups.length}`);
  console.log(`  Members: ${members.length}`);
  console.log(`  GroupManagers: ${gms.length}`);
  console.log(`  Templates: ${templates.length}`);
  console.log(`  Schedules: ${schedules.length}`);
  console.log(`  Tasks: ${tasks.length}`);
  console.log(`  Logs: ${logs.length}`);
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});