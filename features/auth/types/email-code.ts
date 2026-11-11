/** An emailed verification code, as the API describes it (lib/services/email-verification.service.js). */
export type EmailCodeState = {
  /** Where the code went. */
  email: string;
  expiresAt: string | null;
  /** When another code may be requested. */
  resendAt: string;
  /** Why the code could not be sent, when it wasn't. */
  error?: string;
};
