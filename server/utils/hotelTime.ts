export const HOTEL_TIME_ZONE = (process.env.HOTEL_TIMEZONE || "Asia/Manila").trim() || "Asia/Manila";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: HOTEL_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function hotelParts(date: Date = new Date()): ZonedParts {
  const parts: Record<string, number> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour === 24 ? 0 : parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function hotelDateStr(date: Date = new Date()): string {
  const p = hotelParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function hotelTimeStr(date: Date = new Date()): string {
  const p = hotelParts(date);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

function offsetMs(date: Date): number {
  const p = hotelParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

export function isValidDateStr(value: string): boolean {
  if (!DATE_PATTERN.test(value || "")) return false;
  const [y, m, d] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

export function hotelDateTimeToUtc(dateStr: string, timeStr = "00:00"): Date | null {
  if (!isValidDateStr(dateStr) || !TIME_PATTERN.test(timeStr || "")) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  if (hh > 23 || mm > 59) return null;
  const naive = Date.UTC(y, m - 1, d, hh, mm, 0, 0);
  let result = naive - offsetMs(new Date(naive));
  const corrected = naive - offsetMs(new Date(result));
  if (corrected !== result) result = corrected;
  return new Date(result);
}

export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

export function daysBetweenDateStr(from: string, to: string): number {
  if (!isValidDateStr(from) || !isValidDateStr(to)) return 0;
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}
