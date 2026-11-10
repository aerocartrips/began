"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

type FieldShellProps = {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  wide?: boolean;
  /** Read by screen readers only, when the label is already on screen nearby. */
  hideLabel?: boolean;
  /** Small text at the end of the field's last line, e.g. a character count. */
  aside?: ReactNode;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
};

/**
 * The storefront's one form field: label, control, hint and error, wired for
 * screen readers, in the `.account-field` style. TextField, TextAreaField and
 * PasswordField build on it; Select, Combobox and DatePicker take
 * className="account-field" for the same look.
 */
export function FieldShell({ label, error, hint, optional, wide, hideLabel, aside, children }: FieldShellProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`account-field${wide ? " is-wide" : ""}`}>
      <label htmlFor={id} className={hideLabel ? "sr-only" : undefined}>
        {label}
        {optional ? <small> (optional)</small> : null}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error ? <small id={hintId}>{hint}</small> : null}
      {error ? (
        <span id={errorId} className="account-field-error" role="alert">
          {error}
        </span>
      ) : null}
      {aside ? <small className="account-field__aside">{aside}</small> : null}
    </div>
  );
}

type FieldProps = {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  /** Not required; the label says "(optional)". */
  optional?: boolean;
  wide?: boolean;
  hideLabel?: boolean;
};

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & FieldProps;

export function TextField({ label, error, hint, optional, wide, hideLabel, ...inputProps }: TextFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} optional={optional} wide={wide} hideLabel={hideLabel}>
      {({ id, describedBy, invalid }) => (
        <input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} required={!optional} {...inputProps} />
      )}
    </FieldShell>
  );
}

type TextAreaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> &
  FieldProps & {
    /** Shows "120 / 2,000" under the box (needs `value` and `maxLength`). */
    counter?: boolean;
  };

export function TextAreaField({ label, error, hint, optional, wide, hideLabel, counter, ...textareaProps }: TextAreaFieldProps) {
  const { value, maxLength } = textareaProps;
  const count =
    counter && typeof value === "string" && maxLength
      ? `${value.length.toLocaleString("en-IN")} / ${maxLength.toLocaleString("en-IN")}`
      : null;
  return (
    <FieldShell label={label} error={error} hint={hint} optional={optional} wide={wide} hideLabel={hideLabel} aside={count}>
      {({ id, describedBy, invalid }) => (
        <textarea id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} required={!optional} {...textareaProps} />
      )}
    </FieldShell>
  );
}

export function PasswordField({ label, error, hint, wide, ...inputProps }: Omit<TextFieldProps, "type" | "optional" | "hideLabel">) {
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell label={label} error={error} hint={hint} wide={wide}>
      {({ id, describedBy, invalid }) => (
        <span className="account-password-input">
          <input
            id={id}
            type={visible ? "text" : "password"}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            required
            {...inputProps}
          />
          <button
            type="button"
            className="account-icon-button"
            onClick={() => setVisible((value) => !value)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
          >
            {visible ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
          </button>
        </span>
      )}
    </FieldShell>
  );
}
