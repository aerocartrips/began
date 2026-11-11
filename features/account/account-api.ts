import { apiRequest } from "@/lib/api/api-client";
import { isClientApiError } from "@/lib/api/api-error";
import type { EmailCodeState } from "@/features/auth/types/email-code";
import type {
  AccountProfile,
  AddressBook,
  AddressInput,
  DeletionRequest,
  FieldErrors,
  NotificationPreferences,
  SavedAddress,
} from "@/features/account/types";

const JSON_HEADERS = { "Content-Type": "application/json" };

function send<T>(url: string, method: string, body?: unknown) {
  return apiRequest<T>(url, {
    method,
    headers: body === undefined ? undefined : JSON_HEADERS,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Maps server validation errors to `{ field: message }`, first message wins. */
export function toFieldErrors(error: unknown): FieldErrors {
  if (!isClientApiError(error)) return {};
  const result: FieldErrors = {};
  for (const issue of error.errors as { field: string; message: string }[]) {
    result[issue.field] ??= issue.message;
  }
  return result;
}

export const accountApi = {
  updateProfile: (body: Partial<Pick<AccountProfile, "firstName" | "lastName" | "phone" | "companyName" | "gstNumber">>) =>
    send<AccountProfile>("/api/v1/account/profile", "PATCH", body),

  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest<{ avatarUrl: string }>("/api/v1/account/profile/avatar", { method: "PUT", body: formData });
  },
  removeAvatar: () => send<{ avatarUrl: string }>("/api/v1/account/profile/avatar", "DELETE"),

  /** Emails a code to `email` (the current address, or a new one with the current password). Repeat to resend. */
  requestEmailVerification: (body: { email: string; currentPassword?: string }) =>
    send<EmailCodeState & { pendingEmail: string }>("/api/v1/account/email", "POST", body),
  cancelEmailChange: () => send<null>("/api/v1/account/email", "DELETE"),
  confirmEmailCode: (code: string) =>
    send<{ email: string; changed: boolean }>("/api/v1/account/email/verify", "POST", { code }),

  createAddress: (body: AddressInput & { makeDefaultShipping?: boolean; makeDefaultBilling?: boolean }) =>
    send<{ address: SavedAddress; book: AddressBook }>("/api/v1/account/addresses", "POST", body),
  updateAddress: (id: string, body: AddressInput & { makeDefaultShipping?: boolean; makeDefaultBilling?: boolean }) =>
    send<{ address: SavedAddress; book: AddressBook }>(`/api/v1/account/addresses/${encodeURIComponent(id)}`, "PUT", body),
  deleteAddress: (id: string) => send<AddressBook>(`/api/v1/account/addresses/${encodeURIComponent(id)}`, "DELETE"),
  setDefaultAddress: (id: string, type: "shipping" | "billing" | "both") =>
    send<AddressBook>(`/api/v1/account/addresses/${encodeURIComponent(id)}/default`, "POST", { type }),

  updatePreferences: (body: Partial<Omit<NotificationPreferences, "promotionalConsentAt">>) =>
    send<NotificationPreferences>("/api/v1/account/preferences", "PATCH", body),

  changePassword: (body: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
    send<{ passwordChangedAt: string }>("/api/v1/account/password", "POST", body),
  logout: () => send<null>("/api/v1/auth/logout", "POST"),
  logoutAll: () => send<null>("/api/v1/auth/logout-all", "POST"),

  requestDeletion: (body: { currentPassword: string; confirmation: string; reason: string }) =>
    send<DeletionRequest>("/api/v1/account/deletion-request", "POST", body),
  cancelDeletion: () => send<DeletionRequest>("/api/v1/account/deletion-request", "DELETE"),
};
