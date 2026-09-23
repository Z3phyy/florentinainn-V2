import { roomInterface } from "./room.type"

export const BOOKING_TYPES = ["walk in", "walk-in", "reservation"] as const;
export type BookingType = typeof BOOKING_TYPES[number];

export const BOOKING_STATUSES = ["unpaid", "active", "reservation", "completed", "canceled", "no-show"] as const;
export type BookingStatus = typeof BOOKING_STATUSES[number];

export const BOOKING_CREATE_STATUSES: readonly BookingStatus[] = ["active", "unpaid", "reservation"];
export const BOOKING_UPDATE_STATUSES: readonly BookingStatus[] = ["unpaid", "active", "reservation", "completed", "canceled", "no-show"];
export const ONLINE_RESERVATION_STATUSES: readonly BookingStatus[] = ["unpaid"];

export const WALK_IN_TYPES = ["walk in", "walk-in"] as const;

export function isBookingType(value: string): value is BookingType {
  return (BOOKING_TYPES as readonly string[]).includes(value);
}

export function isBookingStatus(value: string): value is BookingStatus {
  return (BOOKING_STATUSES as readonly string[]).includes(value);
}

export function isWalkInType(value: string): boolean {
  return (WALK_IN_TYPES as readonly string[]).includes(value);
}

export interface bookingModification {
  field: string;
  from?: string;
  to?: string;
  note?: string;
  changedBy?: string;
  changedAt?: Date;
}

export interface bookingInterfaceInput {
    clientName: string,
    clientAddress: string,
    clientEmail?: string,
    clientPhone?: string,
    paymentAmount?: number,
    paymentMethod?: string,
    paymentRefNumber?: string,
    totalAmount?: number,
    type: string,
    status: string,
    guests?: number,
    nonRefundable?: boolean,
    policyAcceptedAt?: Date | null,
    arrivalDate: string,
    departureDate?: string,
    arrivalTime: string,
    arrivalNotified?: boolean,
    overdueNotified?: boolean,
    graceNotified?: boolean,
    noShowAt?: Date | null,
    noShowBy?: string,
    noShowReason?: string,
    canceledAt?: Date | null,
    canceledBy?: string,
    cancellationReason?: string,
    checkedOutAt?: Date | null,
    earlyCheckout?: boolean,
    wasRescheduled?: boolean,
    verificationCode?: string,
    modificationHistory?: bookingModification[],
    room : string
}

export interface bookingInterface  {
    clientName: string,
    clientAddress: string,
    clientEmail?: string,
    clientPhone?: string,
    paymentAmount?: number,
    paymentMethod?: string,
    paymentRefNumber?: string,
    totalAmount?: number,
    type: string,
    status: string,
    guests?: number,
    nonRefundable?: boolean,
    policyAcceptedAt?: Date | null,
    arrivalDate: string,
    departureDate?: string,
    arrivalTime: string,
    arrivalNotified?: boolean,
    overdueNotified?: boolean,
    graceNotified?: boolean,
    noShowAt?: Date | null,
    noShowBy?: string,
    noShowReason?: string,
    canceledAt?: Date | null,
    canceledBy?: string,
    cancellationReason?: string,
    checkedOutAt?: Date | null,
    earlyCheckout?: boolean,
    wasRescheduled?: boolean,
    verificationCode?: string,
    modificationHistory?: bookingModification[],
    room : roomInterface,
}