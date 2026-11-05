"use client";

import type { ReactNode, Ref } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  Button,
  FieldError,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select as AriaSelect,
  SelectValue,
  Text,
} from "react-aria-components";

export type SelectOption = {
  id: string;
  label: string;
  /** Secondary text, e.g. what a role can do. */
  description?: string;
  /** CSS colour shown as a dot before the label. */
  swatch?: string;
  disabled?: boolean;
};

type SelectProps = {
  label: ReactNode;
  /** Keeps the label for screen readers only (toolbars, table cells). */
  hideLabel?: boolean;
  options: readonly SelectOption[];
  /** Field wrapper class of the surrounding form (admin-field, account-field, contact-field…). */
  className?: string;
  /** Selected option id; "" means nothing selected. */
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  /** Submits the selected id with a plain HTML form (a hidden native select, so autofill works too). */
  name?: string;
  autoComplete?: string;
  placeholder?: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  /** The field's root element. */
  ref?: Ref<HTMLDivElement>;
};

/** Options from `[value, label]` pairs, e.g. a tuple list or `Object.entries(LABELS)`. */
export function toSelectOptions(pairs: Iterable<readonly [string, string]>): SelectOption[] {
  return Array.from(pairs, ([id, label]) => ({ id, label }));
}

/**
 * The selected key for React Aria: a value that matches an option (including "",
 * which filters use for "All…"); anything else shows the placeholder.
 */
function toKey(value: string | undefined, options: readonly SelectOption[]) {
  if (value === undefined) return undefined;
  return options.some((option) => option.id === value) ? value : null;
}

/**
 * The project's single-select dropdown (ARIA listbox): keyboard, type-ahead and
 * screen-reader support, styled like the fields around it. Use Combobox
 * instead when the list is long enough to need searching.
 */
export default function Select({
  label,
  hideLabel = false,
  options,
  className,
  value,
  defaultValue,
  onChange,
  name,
  autoComplete,
  placeholder = "Select…",
  hint,
  error,
  required,
  disabled,
  ref,
}: SelectProps) {
  return (
    <AriaSelect<SelectOption>
      ref={ref}
      className={["ui-select", className].filter(Boolean).join(" ")}
      value={toKey(value, options)}
      defaultValue={toKey(defaultValue, options)}
      onChange={(key) => onChange?.(key == null ? "" : String(key))}
      disabledKeys={options.filter((option) => option.disabled).map((option) => option.id)}
      name={name}
      autoComplete={autoComplete}
      placeholder={placeholder}
      isRequired={required}
      isDisabled={disabled}
      isInvalid={error ? true : undefined}
    >
      <Label className={hideLabel ? "sr-only" : undefined}>{label}</Label>
      <Button className="ui-select__trigger">
        <SelectValue<SelectOption> className="ui-select__value">
          {({ isPlaceholder, selectedItems, defaultChildren }) => {
            const option = selectedItems[0];
            if (isPlaceholder || !option) return defaultChildren;
            return (
              <>
                {option.swatch ? <span className="ui-swatch" style={{ background: option.swatch }} aria-hidden="true" /> : null}
                {option.label}
              </>
            );
          }}
        </SelectValue>
        <ChevronDown size={14} className="ui-select__chevron" aria-hidden="true" />
      </Button>
      {hint ? <Text slot="description" className="ui-field-hint">{hint}</Text> : null}
      <FieldError className="ui-field-error">{error}</FieldError>
      <Popover className="ui-popover ui-popover--list" offset={4}>
        <ListBox<SelectOption> items={options} className="ui-listbox">
          {(option) => (
            <ListBoxItem id={option.id} textValue={option.label} className="ui-listbox__item">
              {({ isSelected }) => (
                <>
                  {option.swatch ? <span className="ui-swatch" style={{ background: option.swatch }} aria-hidden="true" /> : null}
                  <span className="ui-listbox__label">
                    {option.label}
                    {option.description ? <small>{option.description}</small> : null}
                  </span>
                  {isSelected ? <Check size={14} className="ui-listbox__check" aria-hidden="true" /> : null}
                </>
              )}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}
