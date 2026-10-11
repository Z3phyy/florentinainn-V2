import { daysBetweenDateStr } from "./hotelTime";

export interface PricedAddOn {
  addOn: string;
  name: string;
  unitPrice: number;
  quantity: number;
  pricingUnit: "per_stay" | "per_night";
  nights: number;
  subtotal: number;
}

export function nightlyRate(room: { price?: number; discount?: number } | null | undefined): number {
  const price = Number(room?.price) || 0;
  const discount = Number(room?.discount) || 0;
  return Math.round(price * (1 - discount / 100));
}

export function plannedNights(arrivalDate: string, departureDate?: string): number {
  if (!departureDate) return 1;
  return Math.max(1, daysBetweenDateStr(arrivalDate, departureDate));
}

export function addOnLineSubtotal(unitPrice: number, quantity: number, pricingUnit: string, nights: number): number {
  const multiplier = pricingUnit === "per_night" ? Math.max(1, nights) : 1;
  return Math.round(unitPrice * quantity * multiplier);
}

export function sumAddOns(addOns: { subtotal?: number }[] | null | undefined): number {
  return Math.round((addOns || []).reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0));
}

export function repriceAddOns<T extends { unitPrice: number; quantity: number; pricingUnit: string; nights?: number; subtotal?: number }>(
  addOns: T[] | null | undefined,
  nights: number,
): T[] {
  return (addOns || []).map((item) => ({
    ...item,
    nights: item.pricingUnit === "per_night" ? Math.max(1, nights) : 1,
    subtotal: addOnLineSubtotal(item.unitPrice, item.quantity, item.pricingUnit, nights),
  }));
}

export function stayTotal(input: {
  room: { price?: number; discount?: number } | null | undefined;
  nights: number;
  addOnsTotal?: number;
}) {
  const nightly = nightlyRate(input.room);
  const roomSubtotal = Math.round(nightly * Math.max(1, input.nights));
  const addOnsTotal = Math.round(Number(input.addOnsTotal) || 0);
  return {
    nightlyRate: nightly,
    nights: Math.max(1, input.nights),
    roomSubtotal,
    addOnsTotal,
    total: roomSubtotal + addOnsTotal,
  };
}
