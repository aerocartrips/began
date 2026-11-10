"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { useFeedback } from "@/components/feedback/feedback-provider";
import Button from "@/components/ui/button";
import LoadingButton from "@/components/ui/buttons/loading-button";
import AccountDialog from "@/features/account/components/account-dialog";
import { PasswordField } from "@/components/ui/form/text-field";
import { accountApi, toFieldErrors } from "@/features/account/account-api";
import { completeSignOut } from "@/features/account/session-transitions";
import { authHref } from "@/lib/auth/redirect";
import { SECURITY_EVENT_LABELS } from "@/lib/constants/account";
import { formatDate, formatDateTime } from "@/lib/format";
import type { FieldErrors, SecurityOverview } from "@/features/account/types";

const STRENGTH_LABELS = ["Too short", "Weak", "Fair", "Good", "Strong"];

/** Lightweight client hint; the server enforces the actual policy. */
function passwordStrength(value: string) {
  if (value.length < 8) return 0;
  let score = 1;
  if (/[A-Za-z]/.test(value) && /\d/.test(value)) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 0.5;
  if (/[^A-Za-z0-9]/.test(value)) score += 0.5;
  if (value.length >= 12) score += 1;
  return Math.min(4, Math.floor(score));
}

export default function SecurityPanel({ overview }: { overview: SecurityOverview }) {
  const router = useRouter();
  const feedback = useFeedback();
  const [passwordChangedAt, setPasswordChangedAt] = useState(overview.passwordChangedAt);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmAll, setConfirmAll] = useState(false);
  const [signingOut, setSigningOut] = useState<"current" | "all" | null>(null);
  const strength = passwordStrength(newPassword);

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = {
      currentPassword: String(formData.get("currentPassword") ?? ""),
      newPassword: String(formData.get("newPassword") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    };
    if (body.newPassword !== body.confirmPassword) {
      setErrors({ confirmPassword: "Passwords do not match." });
      return;
    }

    setSaving(true);
    setErrors({});
    try {
      const result = await accountApi.changePassword(body);
      setPasswordChangedAt(result.data?.passwordChangedAt ?? new Date().toISOString());
      form.reset();
      setNewPassword("");
      feedback.success("Password changed", "You stay signed in here. Other devices were signed out.");
      router.refresh();
    } catch (error) {
      const fieldErrors = toFieldErrors(error);
      setErrors(fieldErrors);
      if (!Object.keys(fieldErrors).length) feedback.error("Password not changed", error instanceof Error ? error.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  async function signOut(scope: "current" | "all") {
    setSigningOut(scope);
    try {
      await (scope === "all" ? accountApi.logoutAll() : accountApi.logout());
      completeSignOut(authHref("/account"));
    } catch (error) {
      feedback.error("Sign out failed", error instanceof Error ? error.message : undefined);
      setSigningOut(null);
    }
  }

  return (
    <div className="account-stack">
      <section className="account-panel" aria-labelledby="security-summary-title">
        <div className="account-panel-head">
          <h2 id="security-summary-title">Account security</h2>
          <ShieldCheck size={18} aria-hidden="true" className="account-panel-icon" />
        </div>
        <dl className="account-facts">
          <div><dt>Password last changed</dt><dd>{passwordChangedAt ? formatDate(passwordChangedAt) : "Since account creation"}</dd></div>
          <div><dt>Last sign-in</dt><dd>{formatDateTime(overview.lastLoginAt, "Not recorded yet")}</dd></div>
          <div><dt>Email</dt><dd>{overview.isEmailVerified ? "Verified" : "Not verified"}</dd></div>
          <div><dt>Member since</dt><dd>{formatDate(overview.memberSince)}</dd></div>
        </dl>
        <p className="account-muted">
          Two-factor authentication is not available yet. Use a unique password and sign out of devices you no longer use.
        </p>
      </section>

      <section className="account-panel" aria-labelledby="security-password-title">
        <div className="account-panel-head">
          <h2 id="security-password-title">Change password</h2>
        </div>
        <form className="account-form-grid" onSubmit={submitPassword}>
          <PasswordField label="Current password" name="currentPassword" autoComplete="current-password" error={errors.currentPassword} wide />
          <PasswordField
            label="New password"
            name="newPassword"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            onChange={(event) => setNewPassword(event.currentTarget.value)}
            hint="At least 8 characters, including a letter and a number."
            error={errors.newPassword}
          />
          <PasswordField label="Confirm new password" name="confirmPassword" autoComplete="new-password" maxLength={128} error={errors.confirmPassword} />
          {newPassword ? (
            <div className="account-strength is-wide" aria-live="polite">
              <span className="account-strength-bar" data-score={strength}><span /></span>
              <small>Strength: {STRENGTH_LABELS[strength]}</small>
            </div>
          ) : null}
          <div className="account-form-actions is-wide">
            <LoadingButton type="submit" size="sm" loading={saving} loadingText="Updating...">
              Update password
            </LoadingButton>
          </div>
        </form>
      </section>

      <section className="account-panel" aria-labelledby="security-sessions-title">
        <div className="account-panel-head">
          <h2 id="security-sessions-title">Sessions</h2>
        </div>
        <p className="account-muted">
          Signing out of all devices ends every active session, including this one. Changing your password does this automatically for other devices.
        </p>
        <div className="account-inline-actions">
          <LoadingButton variant="outline" size="sm" loading={signingOut === "current"} loadingText="Signing out..." icon={<LogOut size={14} aria-hidden="true" />} onClick={() => void signOut("current")} disabled={signingOut !== null}>
            Sign out
          </LoadingButton>
          <Button variant="secondary" size="sm" onClick={() => setConfirmAll(true)} disabled={signingOut !== null}>
            Sign out of all devices
          </Button>
        </div>
      </section>

      <section className="account-panel" aria-labelledby="security-activity-title">
        <div className="account-panel-head">
          <h2 id="security-activity-title">Recent security activity</h2>
        </div>
        {overview.activity.length === 0 ? (
          <p className="account-muted">No security changes recorded yet.</p>
        ) : (
          <ol className="account-activity">
            {overview.activity.map((event, index) => (
              <li key={`${event.type}-${event.at}-${index}`}>
                <strong>{SECURITY_EVENT_LABELS[event.type as keyof typeof SECURITY_EVENT_LABELS] ?? event.type}</strong>
                <span>{formatDateTime(event.at)}{event.ip ? ` · IP ${event.ip}` : ""}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <AccountDialog
        open={confirmAll}
        size="sm"
        title="Sign out of all devices?"
        description="You will be signed out everywhere, including this browser, and need to sign in again."
        onClose={() => setConfirmAll(false)}
        busy={signingOut === "all"}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmAll(false)} disabled={signingOut === "all"}>
              Cancel
            </Button>
            <LoadingButton variant="destructive" size="sm" loading={signingOut === "all"} loadingText="Signing out..." onClick={() => void signOut("all")}>
              Sign out everywhere
            </LoadingButton>
          </>
        }
      />
    </div>
  );
}
