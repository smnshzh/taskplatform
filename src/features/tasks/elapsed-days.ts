const DAY_MS = 24 * 60 * 60 * 1000;

export function elapsedDaysSinceStart(startedAt: Date | string | null, now = new Date()): number | null {
  if (!startedAt) return null;
  const start = startedAt instanceof Date ? startedAt : new Date(startedAt);
  if (Number.isNaN(start.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / DAY_MS));
}
