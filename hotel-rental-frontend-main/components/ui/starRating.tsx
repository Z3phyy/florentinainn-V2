"use client";

import { Star } from "lucide-react";

export function StarRating({
  value,
  onChange,
  readOnly,
  size = "md",
}: {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md";
}) {
  const icon = size === "sm" ? "size-3.5" : "size-6";
  return (
    <div className="flex items-center gap-1" role={readOnly ? "img" : "radiogroup"} aria-label={`Rating: ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        const cls = `${icon} ${filled ? "fill-amber-400 text-amber-400" : "text-[#D9C3C3]"}`;
        if (readOnly) return <Star key={star} className={cls} />;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            onClick={() => onChange?.(star)}
            className="rounded p-0.5 focus-visible:outline-2 focus-visible:outline-[#900546]"
          >
            <Star className={cls} />
          </button>
        );
      })}
    </div>
  );
}
