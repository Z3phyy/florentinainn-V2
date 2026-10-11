import { bookingInterface } from "@/app/types/bookings.type";

const VISIBLE_STATUSES = ["active", "reservation", "completed"];

export function isVisibleBooking(b: bookingInterface): boolean {
  return !!b && VISIBLE_STATUSES.includes(b.status);
}

export function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function formatKey(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function todayKey(): string {
  const now = new Date();
  return formatKey(now.getFullYear(), now.getMonth(), now.getDate());
}

export function parseDate(s: string): Date | null {
  const [y, m, nd] = (s || "").split("-").map(Number);
  if (!y || !m || !nd) return null;
  return new Date(y, m - 1, nd);
}

export function bookingDeparture(b: bookingInterface): Date | null {
  if (!b?.departureDate || !/^\d{4}-\d{2}-\d{2}$/.test(b.departureDate))
    return null;
  const departure = parseDate(b.departureDate);
  const arrival = parseDate(b.arrivalDate);
  if (!departure) return null;
  if (arrival && departure.getTime() <= arrival.getTime()) return null;
  return departure;
}

export function bookingNightKeys(b: bookingInterface): string[] {
  if (!b || !b.arrivalDate) return [];
  if (!isVisibleBooking(b)) return [];

  const arrival = parseDate(b.arrivalDate);
  if (!arrival) return [b.arrivalDate];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const departure = bookingDeparture(b);

  let end: Date;
  if (departure) {
    end = departure;
    if (b.status === "active" && end.getTime() <= todayStart.getTime()) {
      end = new Date(
        todayStart.getFullYear(),
        todayStart.getMonth(),
        todayStart.getDate() + 1,
      );
    }
  } else if (b.status === "active") {
    end = new Date(
      todayStart.getFullYear(),
      todayStart.getMonth(),
      todayStart.getDate() + 1,
    );
  } else {
    end = new Date(
      arrival.getFullYear(),
      arrival.getMonth(),
      arrival.getDate() + 1,
    );
  }

  const keys: string[] = [];
  const cur = new Date(
    arrival.getFullYear(),
    arrival.getMonth(),
    arrival.getDate(),
  );
  while (cur.getTime() < end.getTime()) {
    keys.push(formatKey(cur.getFullYear(), cur.getMonth(), cur.getDate()));
    cur.setDate(cur.getDate() + 1);
  }
  return keys.length ? keys : [b.arrivalDate];
}

export function departureKey(b: bookingInterface): string | null {
  if (!isVisibleBooking(b)) return null;
  const departure = bookingDeparture(b);
  if (!departure) return null;
  return formatKey(
    departure.getFullYear(),
    departure.getMonth(),
    departure.getDate(),
  );
}

export function arrivalKey(b: bookingInterface): string | null {
  if (!isVisibleBooking(b)) return null;
  if (!b.arrivalDate || !parseDate(b.arrivalDate)) return null;
  return b.arrivalDate;
}

export function primaryBooking(
  list: bookingInterface[],
): bookingInterface | null {
  return (
    list.find((b) => b.status === "active") ||
    list.find((b) => b.status === "reservation") ||
    list.find((b) => b.status === "completed") ||
    null
  );
}

export interface RoomDayBuckets {
  nights: Map<string, bookingInterface[]>;
  arrivals: Map<string, bookingInterface[]>;
  departures: Map<string, bookingInterface[]>;
}

export function buildRoomDayIndex(
  bookings: bookingInterface[],
): Map<string, RoomDayBuckets> {
  const map = new Map<string, RoomDayBuckets>();

  const push = (
    bucket: Map<string, bookingInterface[]>,
    key: string,
    booking: bookingInterface,
  ) => {
    if (!bucket.has(key)) bucket.set(key, []);
    bucket.get(key)!.push(booking);
  };

  for (const b of bookings) {
    const roomId = typeof b.room === "string" ? b.room : b.room?._id;
    if (!roomId) continue;
    if (!map.has(roomId)) {
      map.set(roomId, {
        nights: new Map(),
        arrivals: new Map(),
        departures: new Map(),
      });
    }
    const entry = map.get(roomId)!;

    for (const key of bookingNightKeys(b)) push(entry.nights, key, b);

    const arrival = arrivalKey(b);
    if (arrival) push(entry.arrivals, arrival, b);

    const departure = departureKey(b);
    if (departure) push(entry.departures, departure, b);
  }

  return map;
}
