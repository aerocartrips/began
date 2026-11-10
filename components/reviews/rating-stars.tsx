"use client";

import type { CSSProperties } from "react";

type RatingStarsProps = {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onChange?: (value: number) => void;
  label?: string;
};

/**
 * Star rating. Read-only stars fill to the exact value (4.6 shows four and a
 * bit more than half stars); the interactive version is a radio group for
 * choosing a whole-star rating.
 */
export default function RatingStars({
  value,
  max = 5,
  size = "md",
  interactive = false,
  onChange,
  label = "Rating",
}: RatingStarsProps) {
  if (!interactive) {
    const clamped = Math.min(max, Math.max(0, Number(value) || 0));
    return (
      <span
        className={`rating-stars rating-stars-${size} rating-stars--static`}
        role="img"
        aria-label={`Rated ${Number(clamped.toFixed(1))} out of ${max}`}
        style={{ "--rating-fill": `${(clamped / max) * 100}%` } as CSSProperties}
      >
        {"★".repeat(max)}
      </span>
    );
  }

  return (
    <div className={`rating-stars rating-stars-${size} rating-stars-interactive`} role="radiogroup" aria-label={label}>
      {Array.from({ length: max }, (_, index) => {
        const starValue = index + 1;
        return (
          <button
            key={starValue}
            type="button"
            role="radio"
            aria-checked={value === starValue}
            className={starValue <= value ? "is-active" : ""}
            onClick={() => onChange?.(starValue)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" && starValue < max) onChange?.(starValue + 1);
              if (event.key === "ArrowLeft" && starValue > 1) onChange?.(starValue - 1);
            }}
          >
            <span aria-hidden="true">★</span>
            <span className="sr-only">{starValue} stars</span>
          </button>
        );
      })}
    </div>
  );
}
