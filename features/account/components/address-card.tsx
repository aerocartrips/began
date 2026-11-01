import type { ReactNode } from "react";
import { Briefcase, Home, MapPin } from "lucide-react";
import { ADDRESS_LABEL_TEXT } from "@/lib/constants/account";
import type { SavedAddress } from "@/features/account/types";

const LABEL_ICONS = { home: Home, office: Briefcase, other: MapPin };

type AddressSummaryProps = {
  address: Omit<SavedAddress, "id" | "updatedAt" | "isDefaultShipping" | "isDefaultBilling"> &
    Partial<Pick<SavedAddress, "isDefaultShipping" | "isDefaultBilling">>;
  compact?: boolean;
};

export function AddressSummary({ address, compact = false }: AddressSummaryProps) {
  const locality = [address.city, address.state, address.pincode].filter(Boolean).join(", ");
  return (
    <address className="account-address">
      <strong>{address.fullName}</strong>
      <span>{[address.addressLine1, address.addressLine2].filter(Boolean).join(", ")}</span>
      {address.landmark && !compact ? <span>Landmark: {address.landmark}</span> : null}
      <span>{locality}{address.country && address.country !== "India" ? `, ${address.country}` : ""}</span>
      <span>{address.phone}</span>
      {address.gstin && !compact ? <span className="account-address-gstin">GSTIN {address.gstin}</span> : null}
    </address>
  );
}

export function AddressBadges({ address }: { address: Pick<SavedAddress, "label" | "isDefaultShipping" | "isDefaultBilling"> }) {
  const Icon = LABEL_ICONS[address.label] ?? MapPin;
  return (
    <div className="account-chip-row">
      <span className="account-chip account-chip--muted">
        <Icon size={11} aria-hidden="true" /> {ADDRESS_LABEL_TEXT[address.label] ?? "Other"}
      </span>
      {address.isDefaultShipping ? <span className="account-chip">Default shipping</span> : null}
      {address.isDefaultBilling ? <span className="account-chip">Default billing</span> : null}
    </div>
  );
}

export default function AddressCard({ address, actions }: { address: SavedAddress; actions?: ReactNode }) {
  const isDefault = address.isDefaultShipping || address.isDefaultBilling;
  return (
    <article className={`address-card${isDefault ? " is-default" : ""}`}>
      <AddressBadges address={address} />
      <AddressSummary address={address} />
      {actions ? <div className="address-card-actions">{actions}</div> : null}
    </article>
  );
}
