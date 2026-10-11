import { Types } from "mongoose";
import BookingsModel from "../model/bookings.model";
import RoomModel from "../model/room.model";
import paymentModel from "../model/payment.model";
import { addDaysToDateStr, daysBetweenDateStr, hotelDateStr, hotelDateTimeToUtc, HOTEL_TIME_ZONE } from "../utils/hotelTime";
import { nightlyRate, plannedNights } from "../utils/pricing";

export class ForecastError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type Confidence = "insufficient" | "low" | "medium" | "high";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const OCCUPYING_STATUSES = ["active", "completed", "reservation"];

const monthOf = (date: string) => date.slice(0, 7);
const labelOf = (month: string) => `${MONTH_LABELS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
const daysInMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
const addMonths = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const monthRange = (from: string, to: string) => {
  const months: string[] = [];
  for (let m = from; m <= to && months.length < 60; m = addMonths(m, 1)) months.push(m);
  return months;
};
const round = (n: number, digits = 1) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};
const pct = (part: number, whole: number) => (whole > 0 ? round((part / whole) * 100) : 0);
const changePct = (current: number, previous: number) =>
  previous > 0 ? round(((current - previous) / previous) * 100) : current > 0 ? null : 0;

function linearFit(values: number[]) {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] || 0 };
  const xs = values.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - meanX) * (values[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: meanY - slope * meanX };
}

function stdDev(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1));
}

export interface ForecastQuery {
  from?: string;
  to?: string;
  horizon?: number;
  roomCategory?: string;
}

export class ForecastService {
  static parseQuery(query: Record<string, unknown>): Required<Omit<ForecastQuery, "roomCategory">> & { roomCategory: string } {
    const currentMonth = monthOf(hotelDateStr());
    const to = typeof query.to === "string" && query.to ? query.to : currentMonth;
    const from = typeof query.from === "string" && query.from ? query.from : addMonths(to, -11);
    if (!MONTH_PATTERN.test(from) || !MONTH_PATTERN.test(to)) {
      throw new ForecastError("Months must use the YYYY-MM format.");
    }
    if (from > to) throw new ForecastError("The start month must be on or before the end month.");
    if (monthRange(from, to).length > 36) throw new ForecastError("Please choose a range of 36 months or less.");
    const horizon = Number(query.horizon ?? 6);
    if (![3, 6, 12].includes(horizon)) throw new ForecastError("Forecast horizon must be 3, 6, or 12 months.");
    const roomCategory = typeof query.roomCategory === "string" ? query.roomCategory.trim().slice(0, 60) : "";
    return { from, to, horizon, roomCategory: roomCategory === "all" ? "" : roomCategory };
  }

  static async compute(params: { from: string; to: string; horizon: number; roomCategory: string }) {
    const { from, to, horizon, roomCategory } = params;
    const today = hotelDateStr();
    const currentMonth = monthOf(today);
    const months = monthRange(from, to);
    const rangeStart = `${from}-01`;
    const rangeEnd = addDaysToDateStr(`${to}-${String(daysInMonth(to)).padStart(2, "0")}`, 1);

    const roomFilter: Record<string, unknown> = { deletedAt: null };
    if (roomCategory) roomFilter.category = roomCategory;
    const [activeRooms, allRooms] = await Promise.all([
      RoomModel.find(roomFilter).select("_id category price discount").lean(),
      RoomModel.find(roomCategory ? { category: roomCategory } : {}).select("_id category price discount").lean(),
    ]);
    const roomById = new Map(allRooms.map((r: any) => [String(r._id), r]));
    const categories = Array.from(new Set(activeRooms.map((r: any) => r.category))).sort();
    const roomsPerCategory = new Map<string, number>();
    for (const r of activeRooms as any[]) roomsPerCategory.set(r.category, (roomsPerCategory.get(r.category) || 0) + 1);

    const bookingFilter: Record<string, unknown> = {
      arrivalDate: { $lt: rangeEnd },
      $or: [{ departureDate: { $gte: rangeStart } }, { arrivalDate: { $gte: rangeStart } }],
    };
    if (roomCategory) bookingFilter.room = { $in: allRooms.map((r: any) => r._id) };
    const bookings: any[] = await BookingsModel.find(bookingFilter)
      .select("room arrivalDate departureDate status totalAmount paymentAmount addOnsTotal checkedOutAt")
      .lean();

    const monthly = new Map(
      months.map((m) => [
        m,
        { bookings: 0, canceled: 0, noShow: 0, roomNights: 0, bookedRevenue: 0, collectedRevenue: 0, refunds: 0 },
      ]),
    );
    const perCategory = new Map<string, { bookings: number; canceled: number; roomNights: number; bookedRevenue: number }>();
    let leadTimeTotal = 0;
    let leadTimeCount = 0;
    let stayTotal = 0;
    let stayCount = 0;

    for (const b of bookings) {
      const room = roomById.get(String(b.room));
      const category = room?.category || "Unknown room";
      const arrivalMonth = monthOf(b.arrivalDate || "");
      const inRange = monthly.has(arrivalMonth);
      const cat = perCategory.get(category) || { bookings: 0, canceled: 0, roomNights: 0, bookedRevenue: 0 };
      const nightsPlanned = plannedNights(b.arrivalDate, b.departureDate);
      const plannedBill = Math.round(nightlyRate(room) * nightsPlanned) + (Number(b.addOnsTotal) || 0);
      const booked =
        b.status === "completed"
          ? Number(b.totalAmount) || plannedBill
          : b.status === "canceled" || b.status === "no-show"
            ? Number(b.paymentAmount) || 0
            : b.status === "unpaid"
              ? 0
              : plannedBill;

      if (inRange) {
        const entry = monthly.get(arrivalMonth)!;
        entry.bookings += 1;
        if (b.status === "canceled") entry.canceled += 1;
        if (b.status === "no-show") entry.noShow += 1;
        entry.bookedRevenue += booked;
        cat.bookings += 1;
        if (b.status === "canceled") cat.canceled += 1;
        cat.bookedRevenue += booked;
        const created = new Types.ObjectId(String(b._id)).getTimestamp();
        const lead = daysBetweenDateStr(hotelDateStr(created), b.arrivalDate);
        if (lead >= 0 && lead < 400) {
          leadTimeTotal += lead;
          leadTimeCount += 1;
        }
        if (OCCUPYING_STATUSES.includes(b.status)) {
          stayTotal += nightsPlanned;
          stayCount += 1;
        }
      }

      if (OCCUPYING_STATUSES.includes(b.status)) {
        const end =
          b.status === "completed" && b.checkedOutAt
            ? hotelDateStr(new Date(b.checkedOutAt))
            : b.departureDate || addDaysToDateStr(b.arrivalDate, 1);
        let day = b.arrivalDate;
        let guard = 0;
        while (day < end && guard < 62) {
          const m = monthOf(day);
          if (monthly.has(m)) {
            monthly.get(m)!.roomNights += 1;
            cat.roomNights += 1;
          }
          day = addDaysToDateStr(day, 1);
          guard += 1;
        }
      }
      perCategory.set(category, cat);
    }

    if (!roomCategory) {
      const payments: any[] = await paymentModel
        .find({ createdAt: { $gte: hotelDateTimeToUtc(rangeStart, "00:00")!, $lt: hotelDateTimeToUtc(rangeEnd, "00:00")! } })
        .select("amount status createdAt")
        .lean();
      for (const p of payments) {
        const m = monthOf(hotelDateStr(new Date(p.createdAt)));
        const entry = monthly.get(m);
        if (!entry) continue;
        if (p.status === "refunded") entry.refunds += Number(p.amount) || 0;
        else entry.collectedRevenue += Number(p.amount) || 0;
      }
    }

    const roomCount = activeRooms.length;
    const monthlyRows = months.map((m) => {
      const e = monthly.get(m)!;
      const capacityNights = roomCount * daysInMonth(m);
      return {
        month: m,
        label: labelOf(m),
        isPartial: m === currentMonth,
        isFuture: m > currentMonth,
        bookings: e.bookings,
        canceled: e.canceled,
        noShow: e.noShow,
        roomNights: e.roomNights,
        capacityNights,
        occupancyRate: pct(e.roomNights, capacityNights),
        bookedRevenue: Math.round(e.bookedRevenue),
        collectedRevenue: roomCategory ? null : Math.round(e.collectedRevenue),
        refunds: roomCategory ? null : Math.round(e.refunds),
        adr: e.roomNights > 0 ? Math.round(e.bookedRevenue / e.roomNights) : 0,
      };
    });

    const history = monthlyRows.filter((r) => !r.isFuture);
    const complete = history.filter((r) => !r.isPartial);
    const totals = history.reduce(
      (acc, r) => {
        acc.bookings += r.bookings;
        acc.canceled += r.canceled;
        acc.noShow += r.noShow;
        acc.roomNights += r.roomNights;
        acc.capacityNights += r.capacityNights;
        acc.bookedRevenue += r.bookedRevenue;
        acc.collectedRevenue += r.collectedRevenue || 0;
        acc.refunds += r.refunds || 0;
        return acc;
      },
      { bookings: 0, canceled: 0, noShow: 0, roomNights: 0, capacityNights: 0, bookedRevenue: 0, collectedRevenue: 0, refunds: 0 },
    );

    const monthsWithBookings = history.filter((r) => r.bookings > 0).length;
    const notes: string[] = [];
    let confidence: Confidence;
    if (roomCount === 0) {
      confidence = "insufficient";
      notes.push("No active rooms match this filter, so occupancy cannot be calculated.");
    } else if (monthsWithBookings < 3 || totals.bookings < 10) {
      confidence = "insufficient";
      notes.push(`Only ${totals.bookings} booking(s) across ${monthsWithBookings} month(s) with activity in this range. At least 10 bookings over 3 months are needed for a forecast.`);
    } else if (complete.length < 6) {
      confidence = "low";
      notes.push("Fewer than 6 complete months of history; treat the forecast as indicative only.");
    } else if (complete.length < 12) {
      confidence = "medium";
      notes.push("Less than a full year of history, so seasonal patterns are not yet measurable.");
    } else {
      confidence = "high";
    }
    if (history.some((r) => r.isPartial)) notes.push(`${labelOf(currentMonth)} is still in progress and is excluded from trend calculations.`);
    if (roomCategory) notes.push("Collected payments cannot be split by room type, so revenue figures use booked (billed) amounts.");

    const seriesBookings = complete.map((r) => r.bookings);
    const seriesNights = complete.map((r) => r.roomNights);
    const lastMonth = monthlyRows.length ? monthlyRows[monthlyRows.length - 1].month : to;
    let method = "none";
    const forecastMonths: {
      month: string;
      label: string;
      bookings: number;
      roomNights: number;
      occupancyRate: number;
      low: number;
      high: number;
    }[] = [];

    if (confidence !== "insufficient" && seriesBookings.length >= 3) {
      const window = seriesBookings.slice(-6);
      const nightsWindow = seriesNights.slice(-6);
      const fit = linearFit(window);
      const nightsFit = linearFit(nightsWindow);
      const movingAvg = seriesBookings.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, seriesBookings.length);
      const nightsAvg = seriesNights.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, seriesNights.length);
      const residuals = window.map((v, i) => v - (fit.intercept + fit.slope * i));
      const spread = Math.max(1, stdDev(residuals) * 1.28);
      const seasonal = complete.length >= 12;
      method = seasonal
        ? "Seasonal index (same month last year) blended with 6-month linear trend"
        : "3-month moving average blended with 6-month linear trend";
      const overallAvg = seriesBookings.reduce((a, b) => a + b, 0) / seriesBookings.length || 1;

      for (let i = 1; i <= horizon; i += 1) {
        const month = addMonths(lastMonth, i);
        const trendValue = fit.intercept + fit.slope * (window.length - 1 + i);
        const nightsTrend = nightsFit.intercept + nightsFit.slope * (nightsWindow.length - 1 + i);
        let bookingsForecast = (trendValue + movingAvg) / 2;
        let nightsForecast = (nightsTrend + nightsAvg) / 2;
        if (seasonal) {
          const sameMonth = complete.filter((r) => r.month.slice(5) === month.slice(5));
          if (sameMonth.length > 0) {
            const index = sameMonth.reduce((s, r) => s + r.bookings, 0) / sameMonth.length / overallAvg;
            bookingsForecast *= index;
            nightsForecast *= index;
          }
        }
        const capacity = roomCount * daysInMonth(month);
        const bookingsValue = Math.max(0, Math.round(bookingsForecast));
        const nightsValue = Math.min(capacity, Math.max(0, Math.round(nightsForecast)));
        forecastMonths.push({
          month,
          label: labelOf(month),
          bookings: bookingsValue,
          roomNights: nightsValue,
          occupancyRate: pct(nightsValue, capacity),
          low: Math.max(0, Math.round(bookingsForecast - spread)),
          high: Math.max(0, Math.round(bookingsForecast + spread)),
        });
      }
    }

    const last3 = complete.slice(-3);
    const prev3 = complete.slice(-6, -3);
    const sum = (rows: typeof complete, key: "bookings" | "bookedRevenue" | "roomNights") =>
      rows.reduce((s, r) => s + r[key], 0);
    const occ = (rows: typeof complete) => pct(rows.reduce((s, r) => s + r.roomNights, 0), rows.reduce((s, r) => s + r.capacityNights, 0));
    const trend =
      prev3.length === 3
        ? {
            comparedPeriods: `${last3[0].label}–${last3[2].label} vs ${prev3[0].label}–${prev3[2].label}`,
            bookingsChangePct: changePct(sum(last3, "bookings"), sum(prev3, "bookings")),
            revenueChangePct: changePct(sum(last3, "bookedRevenue"), sum(prev3, "bookedRevenue")),
            occupancyChangePts: round(occ(last3) - occ(prev3)),
          }
        : null;

    const roomPerformance = Array.from(new Set([...categories, ...perCategory.keys()]))
      .map((category) => {
        const c = perCategory.get(category) || { bookings: 0, canceled: 0, roomNights: 0, bookedRevenue: 0 };
        const rooms = roomsPerCategory.get(category) || 0;
        const capacity = rooms * history.reduce((s, r) => s + daysInMonth(r.month), 0);
        return {
          category,
          rooms,
          bookings: c.bookings,
          roomNights: c.roomNights,
          occupancyRate: pct(c.roomNights, capacity),
          bookedRevenue: Math.round(c.bookedRevenue),
          cancellationRate: pct(c.canceled, c.bookings),
          bookingShare: pct(c.bookings, totals.bookings),
        };
      })
      .sort((a, b) => b.bookedRevenue - a.bookedRevenue);

    const byMonthOfYear = new Map<string, number[]>();
    for (const r of complete) {
      const key = r.month.slice(5);
      byMonthOfYear.set(key, [...(byMonthOfYear.get(key) || []), r.bookings]);
    }
    const avgMonthly = complete.length ? sum(complete, "bookings") / complete.length : 0;
    const seasonality = Array.from(byMonthOfYear.entries())
      .map(([m, values]) => {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        return {
          month: MONTH_LABELS[Number(m) - 1],
          averageBookings: round(avg),
          indexVsAverage: avgMonthly > 0 ? round(avg / avgMonthly, 2) : 0,
          samples: values.length,
        };
      })
      .sort((a, b) => MONTH_LABELS.indexOf(a.month) - MONTH_LABELS.indexOf(b.month));

    return {
      generatedAt: new Date().toISOString(),
      timeZone: HOTEL_TIME_ZONE,
      period: { from, to, months: months.length },
      horizon,
      filters: { roomCategory: roomCategory || "all", categories: Array.from(new Set(allRooms.map((r: any) => r.category))).sort() },
      activeRooms: roomCount,
      dataQuality: {
        historyMonths: history.length,
        completeMonths: complete.length,
        monthsWithBookings,
        totalBookings: totals.bookings,
        confidence,
        notes,
      },
      totals: {
        bookings: totals.bookings,
        canceled: totals.canceled,
        noShow: totals.noShow,
        cancellationRate: pct(totals.canceled, totals.bookings),
        noShowRate: pct(totals.noShow, totals.bookings),
        roomNights: totals.roomNights,
        occupancyRate: pct(totals.roomNights, totals.capacityNights),
        bookedRevenue: Math.round(totals.bookedRevenue),
        collectedRevenue: roomCategory ? null : Math.round(totals.collectedRevenue),
        refunds: roomCategory ? null : Math.round(totals.refunds),
        adr: totals.roomNights > 0 ? Math.round(totals.bookedRevenue / totals.roomNights) : 0,
        avgLengthOfStay: stayCount ? round(stayTotal / stayCount) : 0,
        avgLeadTimeDays: leadTimeCount ? round(leadTimeTotal / leadTimeCount) : 0,
      },
      trend,
      monthly: monthlyRows,
      seasonality,
      roomPerformance,
      forecast: { method, months: forecastMonths },
    };
  }
}
