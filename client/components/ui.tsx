"use client";

import {
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
} from "react";
import { ArrowRightIcon } from "@/components/icons";

const inputBase =
  "w-full rounded-xl border bg-panel-2 px-4 py-3 text-base text-fg sm:text-[15px] placeholder:text-fg-3 outline-none " +
  "transition focus:border-accent focus:ring-4 focus:ring-accent/20";

const labelCls = "block text-[13px] font-medium tracking-wide text-fg-2";

function Message({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error)
    return (
      <p id={`${id}-err`} className="text-xs font-medium text-danger">
        {error}
      </p>
    );
  if (hint) return <p className="text-xs text-fg-3">{hint}</p>;
  return null;
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  /** soft warning (e.g. a low-confidence OCR value): yellow border, not an error */
  warn?: boolean;
};

export function Field({ label, error, hint, warn, className = "", ...props }: FieldProps) {
  const id = useId();
  return (
    <div className="space-y-2">
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        className={`${inputBase} ${error ? "border-danger/70" : warn ? "border-warn/70" : "border-wash/10"} ${className}`}
        {...props}
      />
      <Message id={id} error={error} hint={hint} />
    </div>
  );
}

export function SelectField({
  label,
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();
  return (
    <div className="space-y-2">
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <select id={id} className={`${inputBase} border-wash/10 ${className}`} {...props}>
        {children}
      </select>
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  arrow?: boolean;
  variant?: "primary" | "ghost" | "light" | "danger";
  size?: "md" | "sm";
};

export function Button({
  loading,
  arrow,
  variant = "primary",
  size = "md",
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  const styles = {
    primary: "bg-accent text-accent-ink hover:brightness-110 focus-visible:ring-accent/30",
    ghost: "border border-wash/10 bg-transparent text-fg hover:bg-wash/5 focus-visible:ring-wash/20",
    // The opposite of the page: dark on day mode, light on night mode.
    light: "bg-fg text-page hover:opacity-90 focus-visible:ring-wash/30",
    danger: "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/15 focus-visible:ring-danger/30",
  }[variant];
  const sizing = { md: "px-5 py-3 text-sm", sm: "px-3.5 py-2 text-xs" }[size];
  return (
    <button
      disabled={disabled || loading}
      className={`group inline-flex items-center justify-center gap-2 rounded-xl font-semibold outline-none transition duration-150 focus-visible:ring-4 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${sizing} ${styles} ${className}`}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
      {arrow && !loading && (
        <ArrowRightIcon width={16} height={16} className="transition-transform group-hover:translate-x-0.5" />
      )}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
      {message}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-label={label}>
      <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-accent border-t-transparent" />
    </div>
  );
}
