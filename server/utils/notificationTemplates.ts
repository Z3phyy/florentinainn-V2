import { CreateNotificationInput } from "../services/notification.service";

// Centralized, consistent titles/messages for system-generated notifications.
// Keeps the alert center uniform and makes labels easy to review/change in one
// place instead of buried inside controller logic.

export const formatGraceDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} hr ${m} min`;
  if (h) return `${h} ${h === 1 ? "hour" : "hours"}`;
  return `${m} ${m === 1 ? "minute" : "minutes"}`;
};

const guestLabel = (clientName?: string, clientPhone?: string) =>
  `${clientName || "Guest"}${clientPhone ? ` (${clientPhone})` : ""}`;

export const notificationTemplates = {
  arrivalToday(booking: {
    clientName?: string;
    clientPhone?: string;
    arrivalTime?: string;
  }): CreateNotificationInput {
    return {
      type: "reservation",
      title: "Arrival Today",
      message: `${guestLabel(
        booking.clientName,
        booking.clientPhone,
      )} is expected to arrive today at ${booking.arrivalTime || "—"}.`,
      severity: "info",
      link: "/pages/staff/reservation",
      audience: "staff",
      permission: "frontdesk management",
    };
  },

  overdueArrival(
    booking: {
      clientName?: string;
      clientPhone?: string;
      arrivalDate?: string;
      arrivalTime?: string;
    },
    graceMinutes: number,
  ): CreateNotificationInput {
    return {
      type: "reservation",
      title: "Overdue Arrival",
      message: `${guestLabel(
        booking.clientName,
        booking.clientPhone,
      )} was expected on ${booking.arrivalDate || "—"} at ${
        booking.arrivalTime || "—"
      } and has not checked in after the ${formatGraceDuration(graceMinutes)} grace period.`,
      severity: "danger",
      link: "/pages/staff/reservation",
      audience: "all",
      permission: "frontdesk management",
    };
  },

  gracePeriod(
    booking: {
      clientName?: string;
      clientPhone?: string;
      arrivalTime?: string;
    },
    graceMinutes: number,
    graceEndsLabel: string,
  ): CreateNotificationInput {
    return {
      type: "reservation",
      title: "Grace Period",
      message: `${guestLabel(
        booking.clientName,
        booking.clientPhone,
      )} has not arrived by ${booking.arrivalTime || "—"}. The ${formatGraceDuration(graceMinutes)} grace period has started and ends at ${graceEndsLabel}.`,
      severity: "warning",
      link: "/pages/staff/reservation",
      audience: "all",
      permission: "frontdesk management",
    };
  },
};