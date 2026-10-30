import { Minus, Plus } from "lucide-react";
import Button from "@/components/ui/button";

type QuantitySelectorProps = {
  value: number;
  minimum: number;
  maximum: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
};

export default function QuantitySelector({
  value,
  minimum,
  maximum,
  step = 1,
  disabled = false,
  onChange,
}: QuantitySelectorProps) {
  return (
    <div className="quantity-selector">
      <Button
        type="button"
        variant="form"
        className="quantity-step"
        aria-label="Decrease quantity"
        disabled={disabled || value - step < minimum}
        onClick={() => onChange(Math.max(minimum, value - step))}
        icon={<Minus size={15} aria-hidden="true" />}
      />
      <label>
        <span className="sr-only">Quantity</span>
        <input
          type="number"
          min={minimum}
          max={maximum}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
        />
      </label>
      <Button
        type="button"
        variant="form"
        className="quantity-step"
        aria-label="Increase quantity"
        disabled={disabled || value + step > maximum}
        onClick={() => onChange(Math.min(maximum, value + step))}
        icon={<Plus size={15} aria-hidden="true" />}
      />
    </div>
  );
}