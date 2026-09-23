import { roomInterface } from "./room.type"

export interface bookingModification {
  field: string;
  from?: string;
  to?: string;
  note?: string;
  changedBy?: string;
  changedAt?: string;
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
    policyAcceptedAt?: string | null,
    arrivalDate: string,
    departureDate?: string,
    arrivalTime: string,
    room : string
}

export interface bookingInterface  {
    _id: string,
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
    policyAcceptedAt?: string | null,
    arrivalDate: string,
    departureDate?: string,
    arrivalTime: string,
    noShowAt?: string | null,
    noShowBy?: string,
    noShowReason?: string,
    canceledAt?: string | null,
    canceledBy?: string,
    cancellationReason?: string,
    checkedOutAt?: string | null,
    earlyCheckout?: boolean,
    wasRescheduled?: boolean,
    modificationHistory?: bookingModification[],
    room : roomInterface,
}