import { hotelDateStr } from "./hotelTime";

// Returns a local-timezone date string (YYYY-MM-DD). The server operates in the
// hotel's local time zone (Philippines). Using toISOString() would produce a UTC
// date, which can be off-by-one between midnight and 08:00 local time.
export function localDateStr(d: Date = new Date()): string {
  return hotelDateStr(d);
}