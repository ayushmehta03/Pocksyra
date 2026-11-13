"use client";

import { useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes } from "react";

const inputBase =
  "w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 " +
  "outline-none transition focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string };

export function Field({ label, error, hint, className = "", ...props }: FieldProps) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        className={`${inputBase} ${error ? "border-red-400" : "border-slate-300"} ${className}`}
        {...props}
      />
      {error ? (
        <p id={`${id}-err`} className="text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function PasswordField({ label, error, hint, ...props }: FieldProps) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          className={`${inputBase} pr-16 ${error ? "border-red-400" : "border-slate-300"}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 px-3.5 text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      {error ? (
        <p id={`${id}-err`} className="text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Button({
  loading,
  variant = "primary",
  className = "",
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: "primary" | "ghost" }) {
  const styles =
    variant === "primary"
      ? "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500/40"
      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-400/40";
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold outline-none transition focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${className}`}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
      {message}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-label={label}>
      <span className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
    </div>
  );
}
