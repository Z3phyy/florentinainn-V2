export interface trackedBooking {
    reference: string;
    status: string;
    type: string;
    guestName: string;
    room: { label: string; category: string; image: string };
    arrivalDate: string;
    arrivalTime: string;
    departureDate: string;
    nights: number;
    guests: number;
    roomSubtotal: number;
    addOns: { name: string; quantity: number; subtotal: number }[];
    addOnsTotal: number;
    total: number;
    amountPaid: number;
    balanceDue: number;
    paymentStatus: "paid" | "partial" | "unpaid";
    nonRefundable: boolean;
    createdAt: string;
    checkedOutAt: string | null;
    canceledAt: string | null;
    noShowAt: string | null;
    canReview: boolean;
    reviewed: boolean;
}
