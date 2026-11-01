"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

type FieldShellProps = {
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  wide?: boolean;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
};

/** Label, hint and error wiring shared by every account form control. */
export function FieldShell({ label, error, hint, optional, wide, children }: FieldShellProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`account-field${wide ? " is-wide" : ""}`}>
      <label htmlFor={id}>
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
    </div>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  wide?: boolean;
};

export function TextField({ label, error, hint, optional, wide, ...inputProps }: TextFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} optional={optional} wide={wide}>
      {({ id, describedBy, invalid }) => (
        <input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} required={!optional} {...inputProps} />
      )}
    </FieldShell>
  );
}

export function PasswordField({ label, error, hint, wide, ...inputProps }: Omit<TextFieldProps, "type" | "optional">) {
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
