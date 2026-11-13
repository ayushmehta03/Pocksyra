"use client";

import {
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
} from "react";
import { ArrowRightIcon } from "@/components/icons";

const inputBase =
  "w-full rounded-xl border bg-paper px-4 py-3 text-[15px] text-ink-900 placeholder:text-ink-300 outline-none " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(6,16,13,0.05)] transition " +
  "focus:border-jade-500 focus:ring-4 focus:ring-jade-500/15";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string };

function Message({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error)
    return (
      <p id={`${id}-err`} className="text-xs font-medium text-red-600">
        {error}
      </p>
    );
  if (hint) return <p className="text-xs text-ink-400">{hint}</p>;
  return null;
}

export function Field({ label, error, hint, className = "", ...props }: FieldProps) {
  const id = useId();
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-[13px] font-medium tracking-wide text-ink-700">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        className={`${inputBase} ${error ? "border-red-400" : "border-ivory-300"} ${className}`}
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
      <label htmlFor={id} className="block text-[13px] font-medium tracking-wide text-ink-700">
        {label}
      </label>
      <select id={id} className={`${inputBase} border-ivory-300 ${className}`} {...props}>
        {children}
      </select>
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  arrow?: boolean;
  variant?: "primary" | "jade" | "ghost";
};

export function Button({
  loading,
  arrow,
  variant = "primary",
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  const styles = {
    primary:
      "bg-ink-900 text-ivory-50 hover:bg-ink-800 shadow-[0_10px_28px_-10px_rgba(6,16,13,0.65)] focus-visible:ring-ink-900/25",
    jade: "bg-gradient-to-b from-jade-500 to-jade-600 text-white hover:from-jade-400 hover:to-jade-500 shadow-[0_10px_28px_-10px_rgba(15,154,112,0.7)] focus-visible:ring-jade-500/30",
    ghost:
      "border border-ivory-300 bg-paper text-ink-700 hover:bg-ivory-200 focus-visible:ring-ink-900/15",
  }[variant];
  return (
    <button
      disabled={disabled || loading}
      className={`group inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold outline-none transition focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${className}`}
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
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}

export function Spinner({ label = "Loading", dark = false }: { label?: string; dark?: boolean }) {
  return (
    <div
      className={`flex min-h-screen items-center justify-center ${dark ? "bg-ink-950" : "bg-ivory-100"}`}
      role="status"
      aria-label={label}
    >
      <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-jade-500 border-t-transparent" />
    </div>
  );
}
