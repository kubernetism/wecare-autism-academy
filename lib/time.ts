/**
 * Time-zone helpers. The clinic works in one IANA time zone (CLINIC_TIME_ZONE),
 * so "today" and displayed times do not depend on the server's or a device's
 * clock settings.
 */

/** Offset of `tz` from UTC at `date`, in milliseconds (local minus UTC). */
export function timeZoneOffsetMs(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const wholeSeconds = Math.floor(date.getTime() / 1000) * 1000;
  return asUtc - wholeSeconds;
}

/** `YYYY-MM-DD` of `date` as seen in `tz`. */
export function ymdInZone(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export type WallClock = { year: number; month: number; day: number; hour: number; minute: number };

/** UTC instant of a wall-clock time in `tz` (month is 1-12). */
export function zonedTimeToUtc(wall: WallClock, tz: string): Date {
  const naive = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  // Two passes settle DST transitions.
  let instant = naive - timeZoneOffsetMs(new Date(naive), tz);
  instant = naive - timeZoneOffsetMs(new Date(instant), tz);
  return new Date(instant);
}

/** Wall-clock fields of `date` as seen in `tz`. */
export function wallClockInZone(date: Date, tz: string): WallClock {
  const local = new Date(date.getTime() + timeZoneOffsetMs(date, tz));
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
  };
}

/** UTC instant of local midnight at the start of `ymd` in `tz`. */
export function zonedMidnight(ymd: string, tz: string): Date {
  const [year, month, day] = ymd.split("-").map(Number) as [number, number, number];
  return zonedTimeToUtc({ year, month, day, hour: 0, minute: 0 }, tz);
}

/** [start, end) of the local day containing `date` in `tz`. */
export function dayBounds(date: Date, tz: string): { start: Date; end: Date } {
  const ymd = ymdInZone(date, tz);
  const start = zonedMidnight(ymd, tz);
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  const nextYmd = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  const end = zonedMidnight(nextYmd, tz);
  return { start, end };
}

export function formatDateTime(iso: string, tz: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(iso: string, tz: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
}

export function formatDate(isoOrYmd: string, tz = "UTC"): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(isoOrYmd) ? new Date(`${isoOrYmd}T12:00:00Z`) : new Date(isoOrYmd);
  return date.toLocaleDateString("en-GB", { timeZone: tz, day: "numeric", month: "short", year: "numeric" });
}
