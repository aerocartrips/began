"use client";

import Link from "next/link";
import AddressFormFields from "@/features/account/components/address-form-fields";
import { AddressBadges, AddressSummary } from "@/features/account/components/address-card";
import type { FieldErrors, SavedAddress } from "@/features/account/types";

export const NEW_ADDRESS = "new";

type CheckoutAddressPickerProps = {
  kind: "shipping" | "billing";
  addresses: SavedAddress[];
  value: string;
  onChange: (value: string) => void;
  errors: FieldErrors;
  canSave: boolean;
  atLimit: boolean;
};

/**
 * Saved addresses are referenced by id; the server resolves and revalidates
 * them against the signed-in customer's own address book.
 */
export default function CheckoutAddressPicker({ kind, addresses, value, onChange, errors, canSave, atLimit }: CheckoutAddressPickerProps) {
  const prefix = `${kind}.`;
  const showForm = value === NEW_ADDRESS || addresses.length === 0;
  const selectionError = errors[`${kind}AddressId`];

  return (
    <div className="checkout-address-picker">
      {addresses.length > 0 ? (
        <div className="checkout-address-options" role="radiogroup" aria-label={`Saved ${kind} addresses`}>
          {addresses.map((address) => (
            <label key={address.id} className={`checkout-address-option${value === address.id ? " is-selected" : ""}`}>
              <input type="radio" name={`${kind}Choice`} value={address.id} checked={value === address.id} onChange={() => onChange(address.id)} />
              <span>
                <AddressBadges address={address} />
                <AddressSummary address={address} compact />
              </span>
            </label>
          ))}
          <label className={`checkout-address-option is-new${showForm ? " is-selected" : ""}`}>
            <input type="radio" name={`${kind}Choice`} value={NEW_ADDRESS} checked={showForm} onChange={() => onChange(NEW_ADDRESS)} />
            <span>Use a new address</span>
          </label>
        </div>
      ) : null}
      {selectionError ? <p className="account-field-error" role="alert">{selectionError}</p> : null}

      {showForm ? (
        <div className="checkout-new-address">
          <AddressFormFields prefix={prefix} errors={errors} showGstin={kind === "billing"} />
          {canSave ? (
            <div className="account-checkbox-group">
              <label className="account-checkbox">
                <input type="checkbox" name={`${prefix}save`} defaultChecked={!atLimit} disabled={atLimit} />
                Save this address to my account
              </label>
              {atLimit ? (
                <small className="account-muted">
                  Your address book is full. <Link href="/account/addresses">Manage addresses</Link>
                </small>
              ) : (
                <label className="account-checkbox">
                  <input type="checkbox" name={`${prefix}makeDefault`} defaultChecked={addresses.length === 0} />
                  Make it my default {kind} address
                </label>
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="account-footnote">
          Saved addresses are copied onto the order, so later edits never change it. <Link href="/account/addresses">Manage addresses</Link>
        </p>
      )}
    </div>
  );
}
