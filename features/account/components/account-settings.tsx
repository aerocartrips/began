"use client";

import { useState, type FormEvent } from "react";
import { Download } from "lucide-react";
import { useFeedback } from "@/components/feedback/feedback-provider";
import Button from "@/components/ui/button";
import LoadingButton from "@/components/ui/buttons/loading-button";
import AccountDialog from "@/features/account/components/account-dialog";
import { FieldShell, PasswordField, TextField } from "@/components/ui/form/text-field";
import { accountApi, toFieldErrors } from "@/features/account/account-api";
import { DELETION_CONFIRMATION_PHRASE } from "@/lib/constants/account";
import { formatDate } from "@/lib/format";
import type { DeletionRequest, FieldErrors } from "@/features/account/types";

async function downloadExport() {
  const response = await fetch("/api/v1/account/export", { credentials: "include", cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? "Your data could not be exported right now.");
  }
  const blob = await response.blob();
  const filename = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? "norosilk-account-data.json";
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  link.click();
  URL.revokeObjectURL(url);
}

export default function AccountSettings({ initialDeletion }: { initialDeletion: DeletionRequest }) {
  const feedback = useFeedback();
  const [deletion, setDeletion] = useState(initialDeletion);
  const [exporting, setExporting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  async function handleExport() {
    setExporting(true);
    try {
      await downloadExport();
      feedback.success("Download started", "Your account data is saved as a JSON file.");
    } catch (error) {
      feedback.error("Export failed", error instanceof Error ? error.message : undefined);
    } finally {
      setExporting(false);
    }
  }

  async function submitDeletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const formData = new FormData(event.currentTarget);
    setSubmitting(true);
    setErrors({});
    try {
      const result = await accountApi.requestDeletion({
        currentPassword: String(formData.get("currentPassword") ?? ""),
        confirmation: String(formData.get("confirmation") ?? "").trim(),
        reason: String(formData.get("reason") ?? "").trim(),
      });
      if (result.data) setDeletion(result.data);
      setDialogOpen(false);
      feedback.success("Deletion request received", "Our team will review it and confirm by email.");
    } catch (error) {
      const fieldErrors = toFieldErrors(error);
      setErrors(fieldErrors);
      if (!Object.keys(fieldErrors).length) feedback.error("Request not submitted", error instanceof Error ? error.message : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelDeletion() {
    setSubmitting(true);
    try {
      const result = await accountApi.cancelDeletion();
      if (result.data) setDeletion(result.data);
      feedback.success("Deletion request cancelled", "Your account will stay open.");
    } catch (error) {
      feedback.error("Could not cancel", error instanceof Error ? error.message : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  function openDialog() {
    setErrors({});
    setConfirmation("");
    setDialogOpen(true);
  }

  return (
    <>
      <section className="account-panel" aria-labelledby="settings-privacy-title">
        <div className="account-panel-head">
          <h2 id="settings-privacy-title">Your data</h2>
        </div>
        <p className="account-muted">
          We use your details to process wholesale orders, issue GST invoices, arrange delivery and answer support requests.
          We never sell your data. Download a copy of your profile, addresses, orders, reviews and support messages at any time.
        </p>
        <LoadingButton variant="outline" size="sm" loading={exporting} loadingText="Preparing..." icon={<Download size={14} aria-hidden="true" />} onClick={() => void handleExport()}>
          Download my data
        </LoadingButton>
      </section>

      <section className="account-panel account-danger-zone" aria-labelledby="settings-delete-title">
        <div className="account-panel-head">
          <h2 id="settings-delete-title">Delete account</h2>
          {deletion.status === "pending" ? <span className="account-chip account-chip--danger">Request pending</span> : null}
        </div>
        {deletion.status === "pending" ? (
          <>
            <p className="account-muted">
              You requested deletion on {formatDate(deletion.requestedAt)}. Our team completes requests once open orders, returns and refunds are settled.
              You can keep using your account until then.
            </p>
            <LoadingButton variant="outline" size="sm" loading={submitting} loadingText="Cancelling..." onClick={() => void cancelDeletion()}>
              Cancel deletion request
            </LoadingButton>
          </>
        ) : (
          <>
            <ul className="account-consequences">
              <li>Your profile, saved addresses, preferences and sign-in will be permanently removed.</li>
              <li>Order, payment and invoice records are kept as required by tax law, without your profile details attached.</li>
              <li>Open orders, returns and refunds must be completed before deletion is processed.</li>
            </ul>
            <Button variant="secondary" size="sm" className="account-danger-button" onClick={openDialog}>
              Request account deletion
            </Button>
          </>
        )}
      </section>

      <AccountDialog
        open={dialogOpen}
        tone="danger"
        title="Request account deletion"
        description="This cannot be undone once our team processes it. Confirm with your password to continue."
        onClose={() => setDialogOpen(false)}
        busy={submitting}
      >
        <form className="account-dialog-form" onSubmit={submitDeletion}>
          <div className="account-form-grid">
            <PasswordField label="Current password" name="currentPassword" autoComplete="current-password" error={errors.currentPassword} wide />
            <TextField
              label={`Type ${DELETION_CONFIRMATION_PHRASE} to confirm`}
              name="confirmation"
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.currentTarget.value)}
              error={errors.confirmation}
              wide
            />
            <FieldShell label="Reason" optional wide error={errors.reason}>
              {({ id, describedBy }) => <textarea id={id} name="reason" maxLength={500} aria-describedby={describedBy} placeholder="Help us improve (optional)" />}
            </FieldShell>
          </div>
          <div className="account-dialog-foot">
            <Button variant="secondary" size="sm" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Keep my account
            </Button>
            <LoadingButton
              type="submit"
              variant="destructive"
              size="sm"
              loading={submitting}
              loadingText="Submitting..."
              disabled={confirmation.trim() !== DELETION_CONFIRMATION_PHRASE}
            >
              Request deletion
            </LoadingButton>
          </div>
        </form>
      </AccountDialog>
    </>
  );
}
