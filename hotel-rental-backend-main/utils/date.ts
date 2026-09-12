// Returns a local-timezone date string (YYYY-MM-DD). The server operates in the
// hotel's local time zone (Philippines). Using toISOString() would produce a UTC
// date, which can be off-by-one between midnight and 08:00 local time.
export function localDateStr(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}