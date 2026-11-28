"use client";

import { MoonIcon, SunIcon } from "@/components/icons";
import { AnimatePresence, m } from "@/components/motion";
import { useTheme } from "@/components/theme-provider";

/** Round icon button that flips between day and night mode. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolved, ready, setPreference } = useTheme();
  const dark = resolved === "dark";
  return (
    <button
      type="button"
      onClick={() => setPreference(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to day mode" : "Switch to night mode"}
      className={`relative flex h-11 w-11 items-center justify-center rounded-full text-fg-2 outline-none transition hover:bg-wash/[0.06] hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/50 ${className}`}
    >
      {/* Until the saved choice is known, show nothing rather than the wrong icon. */}
      {ready && (
        <AnimatePresence mode="wait" initial={false}>
          <m.span
            key={dark ? "moon" : "sun"}
            initial={{ rotate: -60, opacity: 0, scale: 0.6 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 60, opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.18 }}
            className="flex"
          >
            {dark ? <MoonIcon width={20} height={20} /> : <SunIcon width={20} height={20} />}
          </m.span>
        </AnimatePresence>
      )}
    </button>
  );
}
