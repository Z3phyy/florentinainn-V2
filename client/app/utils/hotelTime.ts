export const HOTEL_TIME_ZONE = process.env.NEXT_PUBLIC_HOTEL_TIMEZONE || "Asia/Manila";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (DATE_ONLY.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12));
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatHotelDate(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
): string {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("en-PH", { ...options, timeZone: HOTEL_TIME_ZONE });
}

export function formatHotelTime(value: string | Date | null | undefined): string {
  if (!value || (typeof value === "string" && DATE_ONLY.test(value))) return "—";
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", timeZone: HOTEL_TIME_ZONE });
}

export function formatHotelDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  if (typeof value === "string" && DATE_ONLY.test(value)) return formatHotelDate(value);
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: HOTEL_TIME_ZONE,
  });
}

export function hotelDateKey(value: string | Date | null | undefined): string {
  if (typeof value === "string" && DATE_ONLY.test(value)) return value;
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: HOTEL_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
