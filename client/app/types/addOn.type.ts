export interface addOnInterface {
    _id: string;
    name: string;
    description: string;
    price: number;
    pricingUnit: "per_stay" | "per_night";
    maxPerBooking: number;
    stock: number | null;
    isActive: boolean;
    remaining?: number | null;
    bookingCount?: number;
}

export interface addOnSelection {
    addOnId: string;
    quantity: number;
}
