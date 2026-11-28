"use client";

import type { ComponentType, SVGProps } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "@/components/icons";
import { m } from "@/components/motion";
import { useTheme } from "@/components/theme-provider";
import type { ThemePreference } from "@/lib/theme";

const OPTIONS: { id: ThemePreference; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: "light", label: "Day", Icon: SunIcon },
  { id: "dark", label: "Night", Icon: MoonIcon },
  { id: "system", label: "Device", Icon: MonitorIcon },
];

/** Settings card: choose day mode, night mode, or follow the device. */
export function AppearanceCard() {
  const { preference, ready, setPreference } = useTheme();
  return (
    <div className="surface space-y-4 p-6 sm:p-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-fg">Appearance</h2>
        <p className="mt-1 text-sm leading-relaxed text-fg-2">Day, night, or match your device automatically.</p>
      </div>
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-xl bg-panel-2 p-1">
        {OPTIONS.map(({ id, label, Icon }) => {
          const on = ready && preference === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPreference(id)}
              className={`relative flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-accent/50 ${
                on ? "text-fg" : "text-fg-3 hover:text-fg"
              }`}
            >
              {on && (
                <m.span
                  layoutId="appearance-pill"
                  className="absolute inset-0 rounded-lg bg-panel shadow-[var(--shadow-card)]"
                  transition={{ type: "spring", stiffness: 500, damping: 36 }}
                />
              )}
              <span className="relative flex items-center gap-2">
                <Icon width={16} height={16} />
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
