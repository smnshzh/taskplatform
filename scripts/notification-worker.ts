import { db } from "../src/lib/db";
import { processNotificationBatch } from "../src/features/notifications/server/notification.dispatcher";
import { enqueueScheduledNotifications } from "../src/features/notifications/server/scheduled-notifications.service";

const POLL_MS = Math.max(1000, Number(process.env.NOTIFICATION_POLL_MS) || 5000);
let stopping = false;
let lastScheduleMinute = "";
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });

async function main() {
  while (!stopping) {
    try {
      const scheduleMinute = new Date().toISOString().slice(0, 16);
      if (scheduleMinute !== lastScheduleMinute) {
        await enqueueScheduledNotifications();
        lastScheduleMinute = scheduleMinute;
      }
      const count = await processNotificationBatch();
      if (!count) await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    } catch (error) {
      console.error(JSON.stringify({ level: "error", feature: "notifications", action: "worker_batch", result: "failure", errorCode: error instanceof Error ? error.name : "UNKNOWN" }));
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  }
  await db.$disconnect();
}

main().catch(async () => { await db.$disconnect(); process.exit(1); });
