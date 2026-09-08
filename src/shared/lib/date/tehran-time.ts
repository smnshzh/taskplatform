const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;

export function tehranLocalDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - TEHRAN_OFFSET_MS);
}

export function tehranDayRange(now = new Date()): { start: Date; end: Date } {
  const local = new Date(now.getTime() + TEHRAN_OFFSET_MS);
  const startMs = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - TEHRAN_OFFSET_MS;
  return { start: new Date(startMs), end: new Date(startMs + 24 * 60 * 60 * 1000) };
}

export function tehranCalendarDaysBetween(from: Date, to = new Date()): number {
  const fromDay = tehranDayRange(from).start.getTime();
  const toDay = tehranDayRange(to).start.getTime();
  return Math.max(0, Math.round((toDay - fromDay) / (24 * 60 * 60 * 1000)));
}
