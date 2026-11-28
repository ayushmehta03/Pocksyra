export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_KEY = "pocksyra.theme";

/** Browser bar colours; keep in sync with --page in globals.css. */
export const THEME_COLORS: Record<ResolvedTheme, string> = { light: "#fafafa", dark: "#09090b" };

/** Anything stored that isn't a known choice means "follow the device". */
export function parsePreference(raw: string | null | undefined): ThemePreference {
  return raw === "light" || raw === "dark" ? raw : "system";
}

export function resolveTheme(pref: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (pref === "system") return systemDark ? "dark" : "light";
  return pref;
}

/**
 * Runs in <head> before the page paints, so a night-mode user never sees a
 * white flash. It does the same thing as ThemeProvider's first apply.
 */
export const NO_FLASH_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_KEY)});var d=p==="dark"||(p!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",d?${JSON.stringify(THEME_COLORS.dark)}:${JSON.stringify(THEME_COLORS.light)});}catch(e){}})();`;
