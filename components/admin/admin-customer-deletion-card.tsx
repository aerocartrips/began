"use client";

import { useState } from "react";
import AdminCard from "@/components/admin/admin-card";
import { useFeedback } from "@/components/feedback/feedback-provider";
import Button from "@/components/ui/button";
import LoadingButton from "@/components/ui/buttons/loading-button";
import AccountDialog from "@/features/account/components/account-dialog";
import { apiRequest } from "@/lib/api/api-client";
import { formatDateTime } from "@/lib/format";

export type CustomerDeletionInfo = {
  status: "none" | "pending" | "completed";
  requestedAt: string | null;
  reason: string;
  blockers: string[];
};

type AdminCustomerDeletionCardProps = {
  customerId: string;
  deletion: CustomerDeletionInfo;
  onCompleted: () => void;
};

/** Lets staff complete a customer's deletion request once nothing is outstanding. */
export default function AdminCustomerDeletionCard({ customerId, deletion, onCompleted }: AdminCustomerDeletionCardProps) {
  const feedback = useFeedback();
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);

  if (deletion.status === "none") return null;

  async function anonymize() {
    setRunning(true);
    try {
      await apiRequest(`/api/v1/customers/${encodeURIComponent(customerId)}/anonymize`, { method: "POST" });
      feedback.success("Customer anonymized", "Personal data removed; order and invoice records were kept.");
      setConfirming(false);
      onCompleted();
    } catch (error) {
      feedback.error("Anonymization blocked", error instanceof Error ? error.message : undefined);
    } finally {
      setRunning(false);
    }
  }

  if (deletion.status === "completed") {
    return (
      <AdminCard title="Account deletion">
        <p className="account-muted">This account was anonymized. Orders, payments and invoices are retained without personal profile data.</p>
      </AdminCard>
    );
  }

  return (
    <AdminCard title="Deletion requested" description={`Requested ${formatDateTime(deletion.requestedAt)}`}>
      {deletion.reason ? <p className="account-muted">Reason: {deletion.reason}</p> : null}
      {deletion.blockers.length ? (
        <ul className="account-consequences">
          {deletion.blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      ) : (
        <p className="account-muted">No open orders, returns or refunds. The request can be completed.</p>
      )}
      <Button size="sm" variant="secondary" className="account-danger-button" disabled={deletion.blockers.length > 0} onClick={() => setConfirming(true)}>
        Anonymize account
      </Button>
      <AccountDialog
        open={confirming}
        size="sm"
        tone="danger"
        title="Anonymize this customer?"
        description="Name, email, phone, business details, addresses and sign-in are removed permanently. Orders, payments and invoices are kept for legal retention."
        onClose={() => setConfirming(false)}
        busy={running}
        footer={
          <>
            <Button size="sm" variant="secondary" onClick={() => setConfirming(false)} disabled={running}>Cancel</Button>
            <LoadingButton size="sm" variant="destructive" loading={running} loadingText="Anonymizing..." onClick={() => void anonymize()}>
              Anonymize permanently
            </LoadingButton>
          </>
        }
      />
    </AdminCard>
  );
}
