"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check } from "lucide-react";
import Button from "@/components/ui/button";
import LoadingButton from "@/components/ui/buttons/loading-button";
import { TextAreaField, TextField } from "@/components/ui/form/text-field";
import type { ContactFieldErrors } from "@/features/messages/types/contact-message";

type ContactResponse = {
  success?: boolean;
  message?: string;
  data?: { messageId?: string };
  errors?: { field: string; message: string }[];
};

function toFieldErrors(errors: ContactResponse["errors"]): ContactFieldErrors {
  const fieldErrors: ContactFieldErrors = {};
  for (const error of errors ?? []) {
    const field = error.field as keyof ContactFieldErrors;
    fieldErrors[field] ??= error.message;
  }
  return fieldErrors;
}

export default function ContactForm() {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<ContactFieldErrors>({});
  const [requestError, setRequestError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setErrors({});
    setRequestError("");

    const data = new FormData(event.currentTarget);
    const payload = Object.fromEntries(data.entries());
    try {
      const response = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as ContactResponse;
      if (response.ok && result.success && result.data?.messageId) {
        setSubmitted(true);
        formRef.current?.reset();
      } else if (result.errors?.length) {
        setErrors(toFieldErrors(result.errors));
      } else {
        setRequestError(result.message ?? "We could not save your message. Please try again later.");
      }
    } catch {
      setRequestError("We could not reach the message service. Your message has not been submitted.");
    } finally {
      setPending(false);
    }
  }

  if (submitted) {
    return (
      <section className="contact-success" role="status" aria-live="polite">
        <span><Check size={21} aria-hidden="true" /></span>
        <p className="contact-eyebrow">Message saved</p>
        <h2>Thank you for reaching out.</h2>
        <p>Your message is saved in our team inbox. We will follow up using the email you provided.</p>
        <Button type="button" variant="secondary" onClick={() => setSubmitted(false)}>
          Send another message
        </Button>
      </section>
    );
  }

  return (
    <form
      className="contact-form"
      id="contact-form"
      ref={formRef}
      onSubmit={handleSubmit}
      aria-describedby={`${formId}-privacy`}
    >
      <div className="contact-form-heading">
        <p className="contact-eyebrow">Send us a note</p>
        <h2>How can we help?</h2>
        <p>Share a few details and your message will be saved for our team.</p>
      </div>
      <div className="contact-form-grid">
        <TextField label="Full name" name="name" autoComplete="name" minLength={2} maxLength={100} placeholder="Your full name" error={errors.name} />
        <TextField label="Email address" name="email" type="email" autoComplete="email" maxLength={254} placeholder="you@company.com" error={errors.email} />
        <TextField
          label="Phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          maxLength={25}
          pattern="[+0-9(). -]{7,25}"
          placeholder="+91 98765 43210"
          error={errors.phone}
          optional
        />
        <TextField label="Subject" name="subject" minLength={3} maxLength={120} placeholder="Wholesale inquiry, product question…" error={errors.subject} />
        <TextAreaField
          label="Message"
          name="message"
          rows={6}
          minLength={20}
          maxLength={5000}
          placeholder="Tell us what you need—quantities, saree names, timelines, or questions."
          hint="Please include at least 20 characters."
          error={errors.message}
          wide
        />
      </div>
      <div className="contact-honeypot" aria-hidden="true">
        <label htmlFor={`${formId}-website`}>Leave this field empty</label>
        <input id={`${formId}-website`} name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {requestError && <p className="contact-submit-error" role="alert">{requestError}</p>}
      <div className="contact-submit-row">
        <p id={`${formId}-privacy`}>Your details are used only to respond to this inquiry.</p>
        <LoadingButton type="submit" loading={pending} loadingText="Saving message..." icon={<ArrowRight size={15} aria-hidden="true" />}>
          Send message
        </LoadingButton>
      </div>
    </form>
  );
}