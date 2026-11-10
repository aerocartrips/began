"use client";

import type { ReactNode } from "react";
import { Check, ChevronDown, LoaderCircle } from "lucide-react";
import { Button, ComboBox, FieldError, Input, Label, ListBox, ListBoxItem, Popover, Text } from "react-aria-components";

export type ComboboxOption = {
  id: string;
  label: string;
  /** Secondary text, e.g. a SKU. */
  description?: string;
  /** CSS colour shown as a dot before the label. */
  swatch?: string;
  disabled?: boolean;
};

type ComboboxProps = {
  label: ReactNode;
  options: ComboboxOption[];
  /** Field wrapper class: "account-field" on the storefront, "admin-field" in admin. */
  className?: string;
  /** Selected option id; "" means nothing selected. */
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  /** Submits the selected id with a plain HTML form. */
  name?: string;
  placeholder?: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  emptyText?: string;
  /**
   * Server-side search: when set, the caller owns the search text and the
   * options are shown as given (no local filtering).
   */
  search?: { value: string; onChange: (value: string) => void; loading?: boolean };
};

const toKey = (value: string | undefined) => (value === undefined ? undefined : value || null);

/**
 * Searchable single-select (ARIA combobox). Use it for long or data-driven
 * lists (categories, products, attributes); fixed lists use Select. Both share
 * the field, popover and listbox styles in app/form-controls.css.
 */
export default function Combobox({
  label,
  options,
  className,
  value,
  defaultValue,
  onChange,
  name,
  placeholder = "Search…",
  hint,
  error,
  required,
  disabled,
  emptyText = "No matches",
  search,
}: ComboboxProps) {
  const itemProps = search
    ? { items: options, inputValue: search.value, onInputChange: search.onChange }
    : { defaultItems: options };

  return (
    <ComboBox
      {...itemProps}
      className={["ui-combobox", className].filter(Boolean).join(" ")}
      value={toKey(value)}
      defaultValue={toKey(defaultValue)}
      onChange={(key) => onChange?.(key == null ? "" : String(key))}
      disabledKeys={options.filter((option) => option.disabled).map((option) => option.id)}
      name={name}
      isRequired={required}
      isDisabled={disabled}
      isInvalid={error ? true : undefined}
      menuTrigger="focus"
      allowsEmptyCollection
    >
      <Label>{label}</Label>
      <div className="ui-field-control">
        <Input placeholder={placeholder} />
        <Button className="ui-field-button" aria-label="Show options">
          {search?.loading ? <LoaderCircle size={14} className="ui-spin" aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
        </Button>
      </div>
      {hint ? <Text slot="description" className="ui-field-hint">{hint}</Text> : null}
      <FieldError className="ui-field-error">{error}</FieldError>
      <Popover className="ui-popover ui-popover--list" offset={4}>
        <ListBox<ComboboxOption> className="ui-listbox" renderEmptyState={() => <p className="ui-listbox__empty">{search?.loading ? "Searching…" : emptyText}</p>}>
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
    </ComboBox>
  );
}
