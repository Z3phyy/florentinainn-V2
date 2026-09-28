"use client";

import { addOnInterface } from "@/app/types/addOn.type";
import { AddOnQuantities, addOnLineTotal, peso } from "@/app/utils/addOnPricing";
import { Skeleton } from "@/components/ui/skeleton";
import { Minus, PackagePlus, Plus } from "lucide-react";

export function AddOnSelector({
  options,
  value,
  onChange,
  nights,
  isLoading,
  isError,
  ownQuantities = {},
  disabled,
}: {
  options: addOnInterface[];
  value: AddOnQuantities;
  onChange: (next: AddOnQuantities) => void;
  nights: number;
  isLoading?: boolean;
  isError?: boolean;
  ownQuantities?: AddOnQuantities;
  disabled?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    );
  }
  if (isError) {
    return <p className="text-xs text-destructive">Add-ons could not be loaded. You can still continue without them.</p>;
  }
  const visible = options.filter((o) => o.isActive || (value[o._id] || 0) > 0);
  if (visible.length === 0) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <PackagePlus className="size-4" />
        No add-ons are offered right now.
      </p>
    );
  }

  const setQuantity = (id: string, quantity: number) => {
    const next = { ...value };
    if (quantity <= 0) delete next[id];
    else next[id] = quantity;
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {visible.map((addOn) => {
        const quantity = value[addOn._id] || 0;
        const remaining =
          addOn.remaining === null || addOn.remaining === undefined
            ? null
            : addOn.remaining + (ownQuantities[addOn._id] || 0);
        const max = Math.max(0, Math.min(addOn.maxPerBooking, remaining === null ? addOn.maxPerBooking : remaining));
        const soldOut = max === 0 && quantity === 0;
        return (
          <div
            key={addOn._id}
            className={`flex flex-col gap-2 rounded-xl border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${
              quantity > 0 ? "border-[#900546]/40 bg-[#900546]/5" : "border-[#D9C3C3] dark:border-white/10"
            }`}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#130005] dark:text-white">{addOn.name}</p>
              <p className="text-[11px] text-[#5C454B] dark:text-gray-400">
                {peso(addOn.price)} {addOn.pricingUnit === "per_night" ? "per night" : "per stay"}
                {addOn.description ? ` · ${addOn.description}` : ""}
              </p>
              {remaining !== null && (
                <p className={`text-[10px] font-medium ${soldOut ? "text-destructive" : "text-muted-foreground"}`}>
                  {soldOut ? "Fully booked for these dates" : `${remaining} available for these dates`}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label={`Decrease ${addOn.name}`}
                  disabled={disabled || quantity === 0}
                  onClick={() => setQuantity(addOn._id, quantity - 1)}
                  className="flex size-7 items-center justify-center rounded-lg border border-[#D9C3C3] dark:border-white/10 disabled:opacity-40"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="w-6 text-center text-sm font-semibold tabular-nums" aria-live="polite">{quantity}</span>
                <button
                  type="button"
                  aria-label={`Increase ${addOn.name}`}
                  disabled={disabled || quantity >= max || !addOn.isActive}
                  onClick={() => setQuantity(addOn._id, quantity + 1)}
                  className="flex size-7 items-center justify-center rounded-lg border border-[#D9C3C3] dark:border-white/10 disabled:opacity-40"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
              <span className="w-24 text-right text-xs font-semibold tabular-nums text-[#130005] dark:text-white">
                {quantity > 0 ? peso(addOnLineTotal(addOn, quantity, nights)) : "—"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
