"use client";

import { useState } from "react";
import { ADDRESS_LABELS, ADDRESS_LABEL_TEXT, DEFAULT_COUNTRY, INDIAN_STATES } from "@/lib/constants/account";
import Select, { type SelectOption } from "@/components/ui/form/select";
import { TextField } from "@/features/account/components/form-field";
import type { AddressInput, AddressLabel, FieldErrors } from "@/features/account/types";

export const EMPTY_ADDRESS: AddressInput = {
  label: "home",
  fullName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
  country: DEFAULT_COUNTRY,
  gstin: "",
};

const ADDRESS_KEYS = Object.keys(EMPTY_ADDRESS) as (keyof AddressInput)[];
const STATE_OPTIONS: SelectOption[] = INDIAN_STATES.map((state: string) => ({ id: state, label: state }));

/** Reads an address written by <AddressFormFields prefix={prefix} /> out of a form. */
export function readAddressForm(formData: FormData, prefix = ""): AddressInput {
  const values = Object.fromEntries(
    ADDRESS_KEYS.map((key) => [key, String(formData.get(`${prefix}${key}`) ?? "").trim()]),
  ) as Record<keyof AddressInput, string>;
  return { ...values, label: (values.label || "home") as AddressLabel, country: values.country || DEFAULT_COUNTRY };
}

const isIndia = (country: string) => country.trim().toLowerCase() === DEFAULT_COUNTRY.toLowerCase();

type AddressFormFieldsProps = {
  prefix?: string;
  defaults?: Partial<AddressInput>;
  errors?: FieldErrors;
  showGstin?: boolean;
};

/**
 * Uncontrolled address inputs (only the country is tracked, to switch Indian
 * state/PIN rules), so typing never re-renders the surrounding page.
 */
export default function AddressFormFields({ prefix = "", defaults = {}, errors = {}, showGstin = true }: AddressFormFieldsProps) {
  const initial = { ...EMPTY_ADDRESS, ...defaults };
  const [country, setCountry] = useState(initial.country);
  const india = isIndia(country);
  const name = (key: keyof AddressInput) => `${prefix}${key}`;

  return (
    <div className="account-form-grid">
      <fieldset className="account-segmented is-wide">
        <legend>Address type</legend>
        {ADDRESS_LABELS.map((label) => (
          <label key={label}>
            <input type="radio" name={name("label")} value={label} defaultChecked={initial.label === label} />
            <span>{ADDRESS_LABEL_TEXT[label as AddressLabel]}</span>
          </label>
        ))}
      </fieldset>
      <TextField label="Full name" name={name("fullName")} defaultValue={initial.fullName} autoComplete="name" maxLength={120} error={errors.fullName} />
      <TextField
        label="Phone number"
        name={name("phone")}
        type="tel"
        defaultValue={initial.phone}
        autoComplete="tel"
        maxLength={25}
        hint={india ? "10-digit mobile number" : "Include the country code, e.g. +44"}
        error={errors.phone}
      />
      <TextField
        label="Address line 1"
        name={name("addressLine1")}
        defaultValue={initial.addressLine1}
        autoComplete="address-line1"
        maxLength={200}
        placeholder="Building, street"
        error={errors.addressLine1}
        wide
      />
      <TextField
        label="Address line 2"
        name={name("addressLine2")}
        defaultValue={initial.addressLine2}
        autoComplete="address-line2"
        maxLength={200}
        placeholder="Area, locality"
        error={errors.addressLine2}
        optional
        wide
      />
      <TextField label="Landmark" name={name("landmark")} defaultValue={initial.landmark} maxLength={120} error={errors.landmark} optional />
      <TextField label="City" name={name("city")} defaultValue={initial.city} autoComplete="address-level2" maxLength={80} error={errors.city} />
      {india ? (
        <Select
          className="account-field"
          label="State"
          name={name("state")}
          autoComplete="address-level1"
          options={STATE_OPTIONS}
          defaultValue={INDIAN_STATES.find((state) => state.toLowerCase() === initial.state.toLowerCase()) ?? ""}
          placeholder="Select state"
          error={errors.state}
          required
        />
      ) : (
        <TextField label="State / region" name={name("state")} defaultValue={initial.state} autoComplete="address-level1" maxLength={80} error={errors.state} />
      )}
      <TextField
        label={india ? "PIN code" : "Postal code"}
        name={name("pincode")}
        defaultValue={initial.pincode}
        autoComplete="postal-code"
        inputMode={india ? "numeric" : "text"}
        pattern={india ? "[1-9][0-9]{5}" : undefined}
        maxLength={india ? 6 : 10}
        title={india ? "6-digit PIN code" : undefined}
        error={errors.pincode}
      />
      <TextField
        label="Country"
        name={name("country")}
        value={country}
        onChange={(event) => setCountry(event.currentTarget.value)}
        autoComplete="country-name"
        maxLength={80}
        error={errors.country}
      />
      {showGstin ? (
        <TextField
          label="GSTIN"
          name={name("gstin")}
          defaultValue={initial.gstin}
          maxLength={15}
          autoCapitalize="characters"
          hint="Printed on invoices billed to this address."
          error={errors.gstin}
          optional
        />
      ) : null}
    </div>
  );
}
