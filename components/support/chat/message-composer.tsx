"use client";

import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Send } from "lucide-react";

type MessageComposerProps = {
  onSend: (body: string) => unknown;
  maxLength: number;
  placeholder?: string;
  disabled?: boolean;
  disabledReason?: string;
  label?: string;
};

const MAX_HEIGHT_PX = 168;

export default function MessageComposer({
  onSend,
  maxLength,
  placeholder = "Write a message…",
  disabled = false,
  disabledReason,
  label = "Message",
}: MessageComposerProps) {
  const id = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const trimmed = value.trim();
  const tooLong = value.length > maxLength;
  const canSend = !disabled && trimmed.length > 0 && !tooLong;
  const showCount = value.length > maxLength * 0.8;

  function resize() {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT_PX)}px`;
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!canSend) return;
    // Optimistic: the thread shows the message immediately; failures surface on the bubble with a retry.
    void Promise.resolve(onSend(trimmed)).catch(() => {});
    setValue("");
    requestAnimationFrame(() => {
      resize();
      textareaRef.current?.focus();
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  if (disabled && disabledReason) {
    return (
      <div className="support-composer is-disabled" role="status">
        <p>{disabledReason}</p>
      </div>
    );
  }

  return (
    <form className="support-composer" onSubmit={submit}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <textarea
        id={id}
        ref={textareaRef}
        rows={1}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-describedby={`${id}-hint`}
        aria-invalid={tooLong || undefined}
        onChange={(event) => {
          setValue(event.currentTarget.value);
          resize();
        }}
        onKeyDown={handleKeyDown}
      />
      <div className="support-composer__actions">
        <span id={`${id}-hint`} className={tooLong ? "support-composer__hint is-error" : "support-composer__hint"}>
          {showCount
            ? `${value.length.toLocaleString("en-IN")} / ${maxLength.toLocaleString("en-IN")}`
            : "Enter to send · Shift + Enter for a new line"}
        </span>
        <button type="submit" className="support-composer__send" disabled={!canSend} aria-label="Send message">
          <Send size={15} aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}
