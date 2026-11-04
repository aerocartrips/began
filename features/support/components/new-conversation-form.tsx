"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import LoadingButton from "@/components/ui/buttons/loading-button";
import Combobox from "@/components/ui/form/combobox";
import { isClientApiError } from "@/lib/api/api-error";
import { fetchCustomerOrders } from "@/features/orders/order-api";
import { createCustomerConversation, createRequestKey } from "@/features/support/support-api";
import {
  ORDER_LINKED_CATEGORIES,
  SUPPORT_CATEGORY_OPTIONS,
  SUPPORT_MESSAGE_MAX,
} from "@/features/support/support-labels";
import type { CustomerConversation, SupportCategory } from "@/features/support/types";
import { formatDate } from "@/lib/format";

type OrderOption = { id: string; label: string };

type NewConversationFormProps = {
  onCreated: (conversation: CustomerConversation) => void;
  onCancel?: () => void;
  onAuthError: () => void;
};

type FieldErrors = Partial<Record<"category" | "subject" | "message" | "orderId" | "form", string>>;

function useCustomerOrderOptions(enabled: boolean) {
  const [options, setOptions] = useState<OrderOption[] | null>(null);
  useEffect(() => {
    if (!enabled || options) return;
    const controller = new AbortController();
    fetchCustomerOrders({ limit: "20", sort: "desc" })
      .then((result) => {
        if (controller.signal.aborted) return;
        setOptions(
          (result.data ?? []).map((order) => ({
            id: order._id,
            label: `${order.orderNumber} · ${formatDate(order.createdAt)}`,
          })),
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setOptions([]);
      });
    return () => controller.abort();
  }, [enabled, options]);
  return options;
}

export default function NewConversationForm({ onCreated, onCancel, onAuthError }: NewConversationFormProps) {
  const [category, setCategory] = useState<SupportCategory | "">("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [orderId, setOrderId] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  // One key per draft: a retried submit after a network failure cannot create a second conversation.
  const [requestKey, setRequestKey] = useState(createRequestKey);

  const showOrders = category !== "" && ORDER_LINKED_CATEGORIES.has(category);
  const orderOptions = useCustomerOrderOptions(showOrders);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const nextErrors: FieldErrors = {};
    if (!category) nextErrors.category = "Choose a topic.";
    if (subject.trim().length < 3) nextErrors.subject = "Enter a subject of at least 3 characters.";
    if (!message.trim()) nextErrors.message = "Describe how we can help.";
    if (message.length > SUPPORT_MESSAGE_MAX) nextErrors.message = `Messages can be up to ${SUPPORT_MESSAGE_MAX.toLocaleString("en-IN")} characters.`;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !category) return;

    setSubmitting(true);
    try {
      const conversation = await createCustomerConversation({
        category,
        subject: subject.trim(),
        message: message.trim(),
        orderId: showOrders && orderId ? orderId : undefined,
        clientRequestId: requestKey,
      });
      setRequestKey(createRequestKey());
      onCreated(conversation);
    } catch (error) {
      if (isClientApiError(error) && error.status === 401) {
        onAuthError();
        return;
      }
      const fieldErrors: FieldErrors = {};
      if (isClientApiError(error)) {
        for (const issue of error.errors) {
          const field = issue.field as keyof FieldErrors;
          if (["category", "subject", "message", "orderId"].includes(field)) fieldErrors[field] ??= issue.message;
        }
      }
      if (!Object.keys(fieldErrors).length) {
        fieldErrors.form = error instanceof Error ? error.message : "We could not start the conversation. Please try again.";
      }
      setErrors(fieldErrors);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="support-new" onSubmit={handleSubmit} noValidate>
      <header className="support-new__header">
        {onCancel ? (
          <button type="button" className="support-icon-button" onClick={onCancel} aria-label="Back to conversations">
            <ArrowLeft size={16} aria-hidden="true" />
          </button>
        ) : null}
        <div>
          <h2>Start a conversation</h2>
          <p>Our team usually replies within one business day.</p>
        </div>
      </header>

      <fieldset className="support-topics" aria-describedby={errors.category ? "support-category-error" : undefined}>
        <legend>What do you need help with?</legend>
        <div className="support-topics__grid">
          {SUPPORT_CATEGORY_OPTIONS.map((option) => (
            <label key={option.value} className={category === option.value ? "is-selected" : undefined}>
              <input
                type="radio"
                name="category"
                value={option.value}
                checked={category === option.value}
                onChange={() => setCategory(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        {errors.category ? <small id="support-category-error" className="support-field-error">{errors.category}</small> : null}
      </fieldset>

      {showOrders ? (
        <Combobox
          className="account-field"
          label={<>Related order <small>(optional)</small></>}
          placeholder={orderOptions === null ? "Loading your orders…" : orderOptions.length ? "Not about a specific order" : "No orders found"}
          disabled={orderOptions === null || orderOptions.length === 0}
          options={orderOptions ?? []}
          value={orderId}
          onChange={setOrderId}
          error={errors.orderId}
        />
      ) : null}

      <label className="account-field">
        Subject
        <input
          value={subject}
          maxLength={120}
          onChange={(event) => setSubject(event.currentTarget.value)}
          placeholder="e.g. Delivery date for my order"
          aria-invalid={errors.subject ? true : undefined}
        />
        {errors.subject ? <small className="support-field-error">{errors.subject}</small> : null}
      </label>

      <label className="account-field">
        Message
        <textarea
          value={message}
          rows={6}
          onChange={(event) => setMessage(event.currentTarget.value)}
          placeholder="Share the details — order numbers, product names or anything that helps us help you faster."
          aria-invalid={errors.message ? true : undefined}
        />
        <span className="support-new__counter">
          {message.length.toLocaleString("en-IN")} / {SUPPORT_MESSAGE_MAX.toLocaleString("en-IN")}
        </span>
        {errors.message ? <small className="support-field-error">{errors.message}</small> : null}
      </label>

      {errors.form ? <p className="support-form-error" role="alert">{errors.form}</p> : null}

      <div className="support-new__actions">
        {onCancel ? (
          <button type="button" className="text-button" onClick={onCancel}>Cancel</button>
        ) : null}
        <LoadingButton type="submit" size="sm" loading={submitting} loadingText="Sending…">
          Send message
        </LoadingButton>
      </div>
    </form>
  );
}
