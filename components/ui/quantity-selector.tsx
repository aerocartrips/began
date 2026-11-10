"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import Button from "@/components/ui/button";

type QuantitySelectorProps = {
  value: number;
  minimum: number;
  maximum: number;
  step?: number;
  disabled?: boolean;
  /** What is being counted, for screen readers: "Quantity of {label}". */
  label?: string;
  onChange: (value: number) => void;
};

/**
 * Steppers plus a typed quantity. While the shopper types, the draft is kept
 * as typed and only quantities within range are reported, so clearing the
 * field to enter "25" never snaps back to the minimum; leaving the field (or
 * Enter) settles it within range.
 */
export default function QuantitySelector({
  value,
  minimum,
  maximum,
  step = 1,
  disabled = false,
  label,
  onChange,
}: QuantitySelectorProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const upper = Math.max(minimum, maximum);
  const name = label ? `quantity of ${label}` : "quantity";
  const inRange = (count: number) => Number.isInteger(count) && count >= minimum && count <= upper;

  function type(text: string) {
    const digits = text.replace(/\D/g, "").slice(0, 7);
    setDraft(digits);
    const count = Number(digits);
    if (digits && inRange(count) && count !== value) onChange(count);
  }

  function settle() {
    if (draft === null) return;
    const count = Number(draft);
    const settled = draft && Number.isFinite(count) ? Math.min(upper, Math.max(minimum, count)) : value;
    if (settled !== value) onChange(settled);
    setDraft(null);
  }

  return (
    <div className="quantity-selector">
      <Button
        type="button"
        variant="form"
        className="quantity-step"
        aria-label={`Decrease ${name}`}
        disabled={disabled || value - step < minimum}
        onClick={() => onChange(Math.max(minimum, value - step))}
        icon={<Minus size={15} aria-hidden="true" />}
      />
      <label>
        <span className="sr-only">{label ? `Quantity of ${label}` : "Quantity"}</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          role="spinbutton"
          aria-valuemin={minimum}
          aria-valuemax={upper}
          aria-valuenow={value}
          value={draft ?? String(value)}
          disabled={disabled}
          onChange={(event) => type(event.currentTarget.value)}
          onBlur={settle}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              settle();
            } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              const next = value + (event.key === "ArrowUp" ? step : -step);
              setDraft(null);
              if (inRange(next)) onChange(next);
            }
          }}
        />
      </label>
      <Button
        type="button"
        variant="form"
        className="quantity-step"
        aria-label={`Increase ${name}`}
        disabled={disabled || value + step > upper}
        onClick={() => onChange(Math.min(upper, value + step))}
        icon={<Plus size={15} aria-hidden="true" />}
      />
    </div>
  );
}
