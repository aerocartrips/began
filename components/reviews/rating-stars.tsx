"use client";

type RatingStarsProps = {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onChange?: (value: number) => void;
  label?: string;
};

export default function RatingStars({
  value,
  max = 5,
  size = "md",
  interactive = false,
  onChange,
  label = "Rating",
}: RatingStarsProps) {
  return (
    <div
      className={`rating-stars rating-stars-${size}${interactive ? " rating-stars-interactive" : ""}`}
      role={interactive ? "radiogroup" : "img"}
      aria-label={interactive ? label : `${value} out of ${max} stars`}
    >
      {Array.from({ length: max }, (_, index) => {
        const starValue = index + 1;
        const filled = starValue <= Math.round(value);
        if (interactive) {
          return (
            <button
              key={starValue}
              type="button"
              role="radio"
              aria-checked={value === starValue}
              className={filled || starValue <= value ? "is-active" : ""}
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
        }
        return (
          <span key={starValue} className={filled ? "is-active" : ""} aria-hidden="true">
            ★
          </span>
        );
      })}
    </div>
  );
}
