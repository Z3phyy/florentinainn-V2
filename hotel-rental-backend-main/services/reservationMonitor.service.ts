import BookingsModel from "../model/bookings.model";
import { SystemService } from "./system.service";
import { notify } from "../utils/notification";
import { notificationTemplates } from "../utils/notificationTemplates";
import { hotelDateStr, hotelDateTimeToUtc, hotelTimeStr } from "../utils/hotelTime";

export type ArrivalState = "upcoming" | "arriving" | "grace" | "overdue";

export const DEFAULT_GRACE_MINUTES = 120;

export function resolveGraceMinutes(system: any): number {
  const minutes = Number(system?.gracePeriodMinutes);
  if (Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440) return minutes;
  const hours = Number(system?.gracePeriodHours);
  if (Number.isFinite(hours) && hours > 0) return Math.min(1440, Math.max(1, Math.round(hours * 60)));
  return DEFAULT_GRACE_MINUTES;
}

export function arrivalTimeline(
  booking: { arrivalDate: string; arrivalTime?: string },
  graceMinutes: number,
  now: Date = new Date(),
) {
  const arrivalAt = hotelDateTimeToUtc(booking.arrivalDate, booking.arrivalTime || "14:00");
  if (!arrivalAt) return null;
  const graceEndsAt = new Date(arrivalAt.getTime() + graceMinutes * 60 * 1000);
  const nowMs = now.getTime();
  let state: ArrivalState;
  if (nowMs >= graceEndsAt.getTime()) state = "overdue";
  else if (nowMs >= arrivalAt.getTime()) state = "grace";
  else if (booking.arrivalDate === hotelDateStr(now)) state = "arriving";
  else state = "upcoming";
  return { state, arrivalAt, graceEndsAt };
}

let running = false;
let timer: NodeJS.Timeout | null = null;

export class ReservationMonitor {
  static async run(now: Date = new Date()) {
    if (running) return { skipped: true };
    running = true;
    const result = { arrival: 0, grace: 0, overdue: 0 };
    try {
      const system = await SystemService.get();
      const graceMinutes = resolveGraceMinutes(system);
      const today = hotelDateStr(now);

      const arrivals = await BookingsModel.find({
        arrivalDate: today,
        status: "reservation",
        arrivalNotified: { $ne: true },
      }).lean();
      for (const booking of arrivals) {
        const claimed = await BookingsModel.findOneAndUpdate(
          { _id: booking._id, arrivalNotified: { $ne: true } },
          { $set: { arrivalNotified: true } },
        );
        if (!claimed) continue;
        await notify({
          ...notificationTemplates.arrivalToday(booking),
          targetType: "booking",
          targetId: String(booking._id),
        });
        result.arrival += 1;
      }

      const candidates = await BookingsModel.find({
        status: "reservation",
        arrivalDate: { $lte: today },
        $or: [{ graceNotified: { $ne: true } }, { overdueNotified: { $ne: true } }],
      }).lean();

      for (const booking of candidates) {
        const timeline = arrivalTimeline(booking as any, graceMinutes, now);
        if (!timeline) continue;
        const bookingId = String(booking._id);

        if (timeline.state === "grace" && booking.graceNotified !== true) {
          const claimed = await BookingsModel.findOneAndUpdate(
            { _id: booking._id, status: "reservation", graceNotified: { $ne: true } },
            { $set: { graceNotified: true } },
          );
          if (claimed) {
            await notify({
              ...notificationTemplates.gracePeriod(
                booking,
                graceMinutes,
                `${hotelDateStr(timeline.graceEndsAt)} ${hotelTimeStr(timeline.graceEndsAt)}`,
              ),
              targetType: "booking",
              targetId: bookingId,
            });
            result.grace += 1;
          }
        }

        if (timeline.state === "overdue" && booking.overdueNotified !== true) {
          const claimed = await BookingsModel.findOneAndUpdate(
            { _id: booking._id, status: "reservation", overdueNotified: { $ne: true } },
            { $set: { overdueNotified: true, graceNotified: true } },
          );
          if (claimed) {
            await notify({
              ...notificationTemplates.overdueArrival(booking, graceMinutes),
              targetType: "booking",
              targetId: bookingId,
            });
            result.overdue += 1;
          }
        }
      }
    } catch (error) {
      console.log("Reservation monitor error: " + (error as Error).message);
    } finally {
      running = false;
    }
    return result;
  }

  static start(intervalMs = 30000) {
    if (timer) return;
    ReservationMonitor.run();
    timer = setInterval(() => {
      ReservationMonitor.run();
    }, intervalMs);
    timer.unref?.();
  }

  static stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }
}
