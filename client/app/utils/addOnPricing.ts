import { addOnInterface } from "@/app/types/addOn.type";

export type AddOnQuantities = Record<string, number>;

export function addOnLineTotal(addOn: Pick<addOnInterface, "price" | "pricingUnit">, quantity: number, nights: number) {
  const multiplier = addOn.pricingUnit === "per_night" ? Math.max(1, nights) : 1;
  return Math.round(addOn.price * quantity * multiplier);
}

export function addOnsEstimate(options: addOnInterface[], quantities: AddOnQuantities, nights: number) {
  return options.reduce((sum, addOn) => sum + addOnLineTotal(addOn, quantities[addOn._id] || 0, nights), 0);
}

export function toSelection(quantities: AddOnQuantities) {
  return Object.entries(quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([addOnId, quantity]) => ({ addOnId, quantity }));
}

export const peso = (value: number) =>
  `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
