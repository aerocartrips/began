import type { ContactFieldErrors, ContactMessageInput } from "@/features/messages/types/contact-message";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+\d().\s-]{7,25}$/;

export function validateContactMessage(value: unknown):
  | { ok: true; data: ContactMessageInput }
  | { ok: false; errors: ContactFieldErrors } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, errors: { message: "Enter your message and contact details." } };
  }

  const record = value as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
  const phone = typeof record.phone === "string" ? record.phone.trim() : "";
  const subject = typeof record.subject === "string" ? record.subject.trim() : "";
  const message = typeof record.message === "string" ? record.message.trim() : "";
  const errors: ContactFieldErrors = {};

  if (name.length < 2 || name.length > 100) errors.name = "Enter a name between 2 and 100 characters.";
  if (email.length > 254 || !emailPattern.test(email)) errors.email = "Enter a valid email address.";
  if (phone && !phonePattern.test(phone)) errors.phone = "Enter a valid phone number or leave this blank.";
  if (subject.length < 3 || subject.length > 120) errors.subject = "Enter a subject between 3 and 120 characters.";
  if (message.length < 20 || message.length > 5000) errors.message = "Your message must be between 20 and 5,000 characters.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: { name, email, phone: phone || null, subject, message },
  };
}