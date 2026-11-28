"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  THEME_COLORS,
  THEME_KEY,
  parsePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

type ThemeContextValue = {
  /** what the person picked: day, night or follow the device */
  preference: ThemePreference;
  /** what is showing right now */
  resolved: ResolvedTheme;
  /** false until the saved choice has been read, so toggles don't flash the wrong state */
  ready: boolean;
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function apply(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>("system");
  const [systemDark, setSystemDark] = useState(false);
  const [ready, setReady] = useState(false);

  // Read the saved choice and follow the device setting. The inline script in
  // <head> already applied the right class, so nothing flashes.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch {
      /* storage blocked: follow the device */
    }
    setPref(parsePreference(saved));
    setSystemDark(mq.matches);
    setReady(true);

    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    // Another tab changed the choice.
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY) setPref(parsePreference(e.newValue));
    };
    mq.addEventListener("change", onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      mq.removeEventListener("change", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const resolved = resolveTheme(preference, systemDark);

  useEffect(() => {
    if (ready) apply(resolved);
  }, [ready, resolved]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    try {
      localStorage.setItem(THEME_KEY, p);
    } catch {
      /* storage blocked: the choice lasts until the page closes */
    }
  }, []);

  const value = useMemo(() => ({ preference, resolved, ready, setPreference }), [preference, resolved, ready, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
