import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, Ref } from "react";
import { useId } from "react";

export function Button({
  variant = "secondary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "quiet" }) {
  return (
    <button type={type} className={`kl-button kl-button--${variant} ${className}`} {...props} />
  );
}

export function TextField({
  label,
  error,
  hint,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  ref?: Ref<HTMLInputElement>;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const describedBy =
    [props["aria-describedby"], hint && `${fieldId}-hint`, error && `${fieldId}-error`]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className="kl-field">
      <label htmlFor={fieldId}>{label}</label>
      <input
        {...props}
        id={fieldId}
        className="kl-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {hint && (
        <p id={`${fieldId}-hint`} className="kl-status">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${fieldId}-error`} className="kl-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function Checkbox({
  children,
  className = "",
  id,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { children: ReactNode }) {
  const generatedId = useId();
  return (
    <label className={`kl-checkbox ${className}`} htmlFor={id ?? generatedId}>
      <input {...props} type="checkbox" id={id ?? generatedId} />
      <span>{children}</span>
    </label>
  );
}

export function Progress({ label, value, max }: { label: string; value: number; max: number }) {
  const id = useId();
  return (
    <div className="kl-progress">
      <label htmlFor={id}>{label}</label>
      <progress id={id} value={value} max={max} />
    </div>
  );
}

export type ToastTone = "success" | "info" | "error";

export function Toast({
  tone = "info",
  title,
  children,
  onDismiss,
}: {
  tone?: ToastTone;
  title: string;
  children: ReactNode;
  onDismiss: () => void;
}) {
  const titleId = useId();
  return (
    <div className={`kl-toast kl-toast--${tone}`} role="group" aria-labelledby={titleId}>
      <svg
        className="kl-toast-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        {tone === "success" ? (
          <path d="m8 12 3 3 5-6" />
        ) : tone === "error" ? (
          <path d="m9 9 6 6m0-6-6 6" />
        ) : (
          <path d="M12 11v5m0-9v.1" />
        )}
      </svg>
      <div className="kl-toast-copy">
        <p id={titleId} className="kl-toast-title">
          {title}
        </p>
        <div className="kl-toast-message">{children}</div>
      </div>
      <Button
        variant="quiet"
        className="kl-toast-dismiss"
        aria-label={`Meldung schließen: ${title}`}
        onClick={onDismiss}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </Button>
    </div>
  );
}

export function ToastViewport({ children }: { children: ReactNode }) {
  return (
    <section className="kl-toast-viewport" aria-label="Benachrichtigungen">
      {children}
    </section>
  );
}
