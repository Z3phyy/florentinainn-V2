import { roomInterface } from "./room.type"

export interface bookingModification {
  field: string;
  from?: string;
  to?: string;
  note?: string;
  changedBy?: string;
  changedAt?: string;
}

export interface bookingAddOn {
    addOn?: string;
    name: string;
    unitPrice: number;
    quantity: number;
    pricingUnit: "per_stay" | "per_night";
    nights: number;
    subtotal: number;
}

export interface billingAdjustment {
    reason: string;
    previousTotal: number;
    newTotal: number;
    difference: number;
    amountPaid: number;
    balanceDue: number;
    creditDue: number;
    note?: string;
    changedBy?: string;
    changedAt?: string;
}

export type arrivalState = "upcoming" | "arriving" | "grace" | "overdue";

export interface reservationBoardItem extends bookingInterface {
    arrivalState: arrivalState;
    arrivalAt: string | null;
    graceEndsAt: string | null;
    plannedTotal: number;
    balanceDue: number;
    creditDue: number;
}

export interface reservationBoard {
    serverTime: string;
    timeZone: string;
    graceMinutes: number;
    items: reservationBoardItem[];
}

export interface modificationPayment {
    previousTotal: number;
    newTotal: number;
    difference: number;
    amountPaid: number;
    balanceDue: number;
    creditDue: number;
}

export interface modificationSummary {
    bookingId: string;
    revision: number;
    changes: { field: string; from: string; to: string }[];
    room: { _id: string; label: string; nightlyRate: number };
    nights: number;
    roomSubtotal: number;
    addOns: bookingAddOn[];
    addOnsTotal: number;
    payment: modificationPayment;
}

export interface roomAvailabilityItem {
    _id: string;
    roomNumber: string;
    category: string;
    price: number;
    discount: number;
    nightlyRate: number;
    maxHead: number;
    status: string;
    image: string;
    available: boolean;
    reason: string;
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
    addOns?: bookingAddOn[],
    addOnsTotal?: number,
    billingAdjustments?: billingAdjustment[],
    revision?: number,
    referenceCode?: string,
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
    addOns?: bookingAddOn[];
    addOnsTotal?: number;
    billingAdjustments?: billingAdjustment[];
}

export interface reservationHistoryResult {
    items: reservationHistoryItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    statusCounts: Record<string, number>;
}

export interface publicBookingInterface {
    _id: string;
    clientName: string;
    type: string;
    status: string;
    guests?: number;
    arrivalDate: string;
    arrivalTime: string;
    departureDate: string;
    paymentAmount: number;
    paymentMethod: string;
    paymentRefNumber: string;
    totalAmount: number;
    roomSubtotal: number;
    nights: number;
    addOns: bookingAddOn[];
    addOnsTotal: number;
    nonRefundable: boolean;
    checkedOutAt: string | null;
    room: roomInterface;
}
