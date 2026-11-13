"use client";

import {
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
} from "react";
import { ArrowRightIcon } from "@/components/icons";

const inputBase =
  "w-full rounded-xl border bg-white/[0.04] px-4 py-3 text-[15px] text-ivory-50 placeholder:text-ink-400 outline-none " +
  "transition focus:border-jade-400/70 focus:bg-white/[0.06] focus:ring-4 focus:ring-jade-400/15";

const labelCls = "block text-[13px] font-medium tracking-wide text-ink-300";

function Message({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error)
    return (
      <p id={`${id}-err`} className="text-xs font-medium text-red-400">
        {error}
      </p>
    );
  if (hint) return <p className="text-xs text-ink-400">{hint}</p>;
  return null;
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string };

export function Field({ label, error, hint, className = "", ...props }: FieldProps) {
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
        className={`${inputBase} ${error ? "border-red-400/70" : "border-white/10"} ${className}`}
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
      <select id={id} className={`${inputBase} border-white/10 ${className}`} {...props}>
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
    primary:
      "bg-gradient-to-b from-jade-400 to-jade-500 text-ink-950 hover:from-jade-300 hover:to-jade-400 shadow-[0_10px_30px_-10px_rgba(63,214,163,0.55)] focus-visible:ring-jade-400/30",
    ghost:
      "border border-white/10 bg-white/[0.04] text-ivory-100 hover:bg-white/[0.08] focus-visible:ring-white/20",
    light:
      "bg-white text-ink-900 hover:bg-ivory-100 shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] focus-visible:ring-white/30",
    danger:
      "border border-red-400/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 focus-visible:ring-red-400/30",
  }[variant];
  const sizing = { md: "px-5 py-3 text-sm", sm: "px-3.5 py-2 text-xs" }[size];
  return (
    <button
      disabled={disabled || loading}
      className={`group inline-flex items-center justify-center gap-2 rounded-xl font-semibold outline-none transition focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50 ${sizing} ${styles} ${className}`}
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
    <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      {message}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-label={label}>
      <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-jade-400 border-t-transparent" />
    </div>
  );
}
