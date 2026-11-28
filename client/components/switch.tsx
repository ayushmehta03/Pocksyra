"use client";

import { EASE, m } from "@/components/motion";

/** An on/off switch whose knob slides. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full outline-none transition-colors focus-visible:ring-4 focus-visible:ring-accent/25 disabled:opacity-60 ${
        checked ? "bg-accent" : "bg-wash/20"
      }`}
    >
      <m.span
        layout
        transition={{ duration: 0.22, ease: EASE }}
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 ${checked ? "right-0.5" : "left-0.5"}`}
      />
    </button>
  );
}
