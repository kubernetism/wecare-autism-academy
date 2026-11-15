import dayjs, { type Dayjs } from "dayjs";
import { wallClockInZone, zonedTimeToUtc } from "@/lib/time";

/**
 * Date-time pickers show clinic wall-clock time regardless of the device's
 * time zone. These convert between a picker value and an ISO instant.
 */
export function pickerToIso(value: Dayjs, timeZone: string): string {
  return zonedTimeToUtc(
    { year: value.year(), month: value.month() + 1, day: value.date(), hour: value.hour(), minute: value.minute() },
    timeZone,
  ).toISOString();
}

export function isoToPicker(iso: string, timeZone: string): Dayjs {
  const w = wallClockInZone(new Date(iso), timeZone);
  return dayjs(new Date(w.year, w.month - 1, w.day, w.hour, w.minute));
}

/** Parseable picker format (dayjs cannot parse weekday names). */
export const DATE_TIME_FORMATS = ["D MMM YYYY, HH:mm", "D/M/YYYY HH:mm", "YYYY-MM-DD HH:mm"];
