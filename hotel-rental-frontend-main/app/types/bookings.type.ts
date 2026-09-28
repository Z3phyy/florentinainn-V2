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
export type reservationPaymentStatus = "paid" | "partial" | "unpaid";

export interface reservationHistoryItem {
    bookingId: string;
    reference: string;
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
    guests?: number;
    type: string;
    status: string;
    arrivalDate: string;
    arrivalTime?: string;
    departureDate?: string;
    nights: number;
    checkedOutAt?: string | null;
    earlyCheckout?: boolean;
    canceledAt?: string | null;
    cancellationReason?: string;
    noShowAt?: string | null;
    paymentMethod?: string;
    paymentRefNumber?: string;
    amountPaid: number;
    billTotal: number;
    balance: number;
    paymentStatus: reservationPaymentStatus;
    createdAt: string;
    updatedAt: string;
    room: { _id?: string; roomNumber?: string; category?: string };
    handledBy: string[];
    modificationHistory?: bookingModification[];
}

export interface reservationHistoryResult {
    items: reservationHistoryItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    statusCounts: Record<string, number>;
}
