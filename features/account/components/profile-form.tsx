"use client";

import Image from "next/image";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Camera, Mail, Trash2 } from "lucide-react";
import { useFeedback } from "@/components/feedback/feedback-provider";
import Button from "@/components/ui/button";
import LoadingButton from "@/components/ui/buttons/loading-button";
import { PasswordField, TextField } from "@/components/ui/form/text-field";
import { accountApi, toFieldErrors } from "@/features/account/account-api";
import type { AccountCapabilities, AccountProfile, FieldErrors } from "@/features/account/types";

type ProfileFormProps = {
  initialProfile: AccountProfile;
  capabilities: AccountCapabilities;
};

function initialsOf(profile: AccountProfile) {
  return (`${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}` || profile.email.charAt(0)).toUpperCase();
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : undefined);

export default function ProfileForm({ initialProfile, capabilities }: ProfileFormProps) {
  const router = useRouter();
  const feedback = useFeedback();
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState(initialProfile);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [emailErrors, setEmailErrors] = useState<FieldErrors>({});
  const [emailBusy, setEmailBusy] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const formData = new FormData(event.currentTarget);
    const read = (key: string) => String(formData.get(key) ?? "").trim();
    setSaving(true);
    setErrors({});
    try {
      const result = await accountApi.updateProfile({
        firstName: read("firstName"),
        lastName: read("lastName"),
        phone: read("phone"),
        companyName: read("companyName"),
        gstNumber: read("gstNumber"),
      });
      if (result.data) setProfile(result.data);
      feedback.success("Profile updated");
      router.refresh();
    } catch (error) {
      const fieldErrors = toFieldErrors(error);
      setErrors(fieldErrors);
      if (!Object.keys(fieldErrors).length) feedback.error("Profile not saved", errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function changeAvatar(file: File | undefined) {
    if (!file) return;
    setAvatarBusy(true);
    try {
      const result = await accountApi.uploadAvatar(file);
      setProfile((current) => ({ ...current, avatarUrl: result.data?.avatarUrl ?? current.avatarUrl }));
      feedback.success("Profile photo updated");
      router.refresh();
    } catch (error) {
      feedback.error("Photo not uploaded", errorMessage(error));
    } finally {
      setAvatarBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function deleteAvatar() {
    setAvatarBusy(true);
    try {
      await accountApi.removeAvatar();
      setProfile((current) => ({ ...current, avatarUrl: "" }));
      feedback.success("Profile photo removed");
      router.refresh();
    } catch (error) {
      feedback.error("Photo not removed", errorMessage(error));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function requestVerification(body: { email: string; currentPassword?: string }) {
    setEmailBusy(true);
    setEmailErrors({});
    try {
      const result = await accountApi.requestEmailVerification(body);
      if (result.data?.pendingEmail) {
        setProfile((current) => ({ ...current, pendingEmail: result.data?.pendingEmail ?? "", pendingEmailExpiresAt: result.data?.expiresAt ?? null }));
        setShowEmailForm(false);
      }
      feedback.success("Verification email sent", `Check the inbox for ${body.email} and open the link within 1 hour.`);
    } catch (error) {
      const fieldErrors = toFieldErrors(error);
      setEmailErrors(fieldErrors);
      if (!Object.keys(fieldErrors).length) feedback.error("Email not sent", errorMessage(error));
    } finally {
      setEmailBusy(false);
    }
  }

  async function cancelPendingEmail() {
    setEmailBusy(true);
    try {
      await accountApi.cancelEmailChange();
      setProfile((current) => ({ ...current, pendingEmail: "", pendingEmailExpiresAt: null }));
      feedback.info("Email change cancelled");
    } catch (error) {
      feedback.error("Could not cancel", errorMessage(error));
    } finally {
      setEmailBusy(false);
    }
  }

  return (
    <div className="account-stack">
      <section className="account-panel" aria-labelledby="profile-details-title">
        <div className="account-panel-head">
          <h2 id="profile-details-title">Personal information</h2>
        </div>

        <div className="account-avatar-row">
          <span className="account-avatar account-avatar--lg" aria-hidden={!profile.avatarUrl}>
            {profile.avatarUrl ? (
              <Image src={profile.avatarUrl} alt="Your profile photo" fill sizes="72px" className="cover-image" />
            ) : (
              initialsOf(profile)
            )}
          </span>
          {capabilities.avatarUpload ? (
            <div className="account-avatar-actions">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                id="avatar-upload"
                onChange={(event) => void changeAvatar(event.currentTarget.files?.[0])}
              />
              <LoadingButton
                variant="outline"
                size="sm"
                loading={avatarBusy}
                loadingText="Uploading..."
                icon={<Camera size={14} aria-hidden="true" />}
                onClick={() => fileRef.current?.click()}
              >
                {profile.avatarUrl ? "Change photo" : "Upload photo"}
              </LoadingButton>
              {profile.avatarUrl ? (
                <button type="button" className="account-link-button is-danger" onClick={() => void deleteAvatar()} disabled={avatarBusy}>
                  <Trash2 size={13} aria-hidden="true" /> Remove
                </button>
              ) : null}
              <small>JPG, PNG or WebP, up to 5 MB.</small>
            </div>
          ) : (
            <p className="account-muted">Profile photo uploads are not enabled for this store.</p>
          )}
        </div>

        <form className="account-form-grid" onSubmit={saveDetails}>
          <TextField label="First name" name="firstName" defaultValue={profile.firstName} autoComplete="given-name" maxLength={60} error={errors.firstName} />
          <TextField label="Last name" name="lastName" defaultValue={profile.lastName} autoComplete="family-name" maxLength={60} error={errors.lastName} optional />
          <TextField
            label="Phone number"
            name="phone"
            type="tel"
            defaultValue={profile.phone}
            autoComplete="tel"
            maxLength={25}
            hint="Used by our team and couriers for order updates. Not verified by SMS."
            error={errors.phone}
            optional
          />
          <TextField label="Business name" name="companyName" defaultValue={profile.companyName} autoComplete="organization" maxLength={160} error={errors.companyName} optional />
          <TextField
            label="GSTIN"
            name="gstNumber"
            defaultValue={profile.gstNumber}
            maxLength={15}
            autoCapitalize="characters"
            hint="Printed on invoices when your billing address has no GSTIN of its own."
            error={errors.gstNumber}
            optional
          />
          <div className="account-form-actions is-wide">
            <LoadingButton type="submit" size="sm" loading={saving} loadingText="Saving...">
              Save changes
            </LoadingButton>
          </div>
        </form>
      </section>

      <section className="account-panel" aria-labelledby="profile-email-title">
        <div className="account-panel-head">
          <h2 id="profile-email-title">Email address</h2>
          {profile.isEmailVerified ? (
            <span className="account-chip account-chip--success"><BadgeCheck size={11} aria-hidden="true" /> Verified</span>
          ) : (
            <span className="account-chip account-chip--warning">Not verified</span>
          )}
        </div>
        <p className="account-email-line">
          <Mail size={15} aria-hidden="true" /> <strong>{profile.email}</strong>
        </p>

        {profile.pendingEmail ? (
          <div className="account-callout" role="status">
            <p>
              We sent a confirmation link to <strong>{profile.pendingEmail}</strong>. Your email changes only after you open it.
            </p>
            <button type="button" className="account-link-button" onClick={() => void cancelPendingEmail()} disabled={emailBusy}>
              Cancel change
            </button>
          </div>
        ) : null}

        {!capabilities.emailVerification ? (
          <p className="account-muted">
            Email changes require verification, which is not available right now. Contact support if you need to update your email.
          </p>
        ) : (
          <>
            <div className="account-inline-actions">
              {!profile.isEmailVerified ? (
                <LoadingButton variant="outline" size="sm" loading={emailBusy && !showEmailForm} loadingText="Sending..." onClick={() => void requestVerification({ email: profile.email })}>
                  Send verification email
                </LoadingButton>
              ) : null}
              {!showEmailForm ? (
                <Button variant="secondary" size="sm" onClick={() => setShowEmailForm(true)}>
                  Change email
                </Button>
              ) : null}
            </div>
            {showEmailForm ? (
              <form
                className="account-form-grid account-subform"
                onSubmit={(event) => {
                  event.preventDefault();
                  const formData = new FormData(event.currentTarget);
                  void requestVerification({
                    email: String(formData.get("email") ?? "").trim(),
                    currentPassword: String(formData.get("currentPassword") ?? ""),
                  });
                }}
              >
                <TextField label="New email address" name="email" type="email" autoComplete="email" maxLength={254} error={emailErrors.email} />
                <PasswordField label="Current password" name="currentPassword" autoComplete="current-password" error={emailErrors.currentPassword} />
                <div className="account-form-actions is-wide">
                  <Button variant="secondary" size="sm" onClick={() => setShowEmailForm(false)} disabled={emailBusy}>
                    Cancel
                  </Button>
                  <LoadingButton type="submit" size="sm" loading={emailBusy} loadingText="Sending...">
                    Send confirmation link
                  </LoadingButton>
                </div>
              </form>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
