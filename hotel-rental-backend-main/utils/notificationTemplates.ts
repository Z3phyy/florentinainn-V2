import { CreateNotificationInput } from "../services/notification.service";

// Centralized, consistent titles/messages for system-generated notifications.
// Keeps the alert center uniform and makes labels easy to review/change in one
// place instead of buried inside controller logic.

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

  overdueArrival(booking: {
    clientName?: string;
    clientPhone?: string;
    arrivalDate?: string;
    arrivalTime?: string;
  }): CreateNotificationInput {
    return {
      type: "reservation",
      title: "Overdue Arrival",
      message: `${guestLabel(
        booking.clientName,
        booking.clientPhone,
      )} was expected to arrive on ${booking.arrivalDate || "—"} at ${
        booking.arrivalTime || "—"
      } but has not checked in.`,
      severity: "warning",
      link: "/pages/staff/reservation",
      audience: "staff",
      permission: "frontdesk management",
    };
  },

  gracePeriod(
    booking: {
      clientName?: string;
      clientPhone?: string;
      arrivalTime?: string;
    },
    graceHours: number,
  ): CreateNotificationInput {
    return {
      type: "reservation",
      title: "Grace Period",
      message: `${guestLabel(
        booking.clientName,
        booking.clientPhone,
      )} has passed the arrival time of ${booking.arrivalTime || "—"} and is now within the ${graceHours}-hour grace period.`,
      severity: "warning",
      link: "/pages/staff/reservation",
      audience: "staff",
      permission: "frontdesk management",
    };
  },
};