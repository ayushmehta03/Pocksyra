import type { ReactNode, SVGProps } from "react";
import { categoryLabel } from "@/lib/categories";

type P = SVGProps<SVGSVGElement>;

function Svg({ children, ...p }: P & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
      {children}
    </svg>
  );
}

// One small line icon per category id (see lib/categories.ts).
const GLYPHS: Record<string, ReactNode> = {
  food: (
    <>
      <path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10" />
      <path d="M17 21V3c-2.5 1.5-3.5 4.5-3.5 8H17" />
    </>
  ),
  groceries: (
    <>
      <path d="M3 4h2.5l2 11h10l2-8H7" />
      <circle cx="9" cy="19.5" r="1.3" />
      <circle cx="17" cy="19.5" r="1.3" />
    </>
  ),
  transport: (
    <>
      <path d="M5 16V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v8z" />
      <path d="M5 12h14M7 16v3M17 16v3" />
      <circle cx="8.5" cy="14" r=".6" />
      <circle cx="15.5" cy="14" r=".6" />
    </>
  ),
  rent: (
    <>
      <path d="M3 11 12 3l9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  utilities: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  entertainment: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m10 9 5 3-5 3z" />
    </>
  ),
  travel: <path d="M10.5 13.5 3 11l1.5-1.5 9 .5 4.5-4.5a1.8 1.8 0 0 1 2.5 2.5L16 12.5l.5 9L15 23l-2.5-7.5-4 3.5-1-1z" transform="translate(0 -2) scale(.95)" />,
  shopping: (
    <>
      <path d="M5 8h14l-1 12H6z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  health: (
    <>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
      <path d="M12 9v4M10 11h4" />
    </>
  ),
  other: (
    <>
      <circle cx="6" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="18" cy="12" r="1.3" />
    </>
  ),
};

// Tile colours: soft tint plus matching icon colour.
const TONES: Record<string, string> = {
  food: "bg-orange-400/15 text-orange-300",
  groceries: "bg-lime-400/15 text-lime-300",
  transport: "bg-sky-400/15 text-sky-300",
  rent: "bg-violet-400/15 text-violet-300",
  utilities: "bg-yellow-400/15 text-yellow-300",
  entertainment: "bg-pink-400/15 text-pink-300",
  travel: "bg-cyan-400/15 text-cyan-300",
  shopping: "bg-fuchsia-400/15 text-fuchsia-300",
  health: "bg-rose-400/15 text-rose-300",
  other: "bg-white/[0.07] text-ink-300",
};

export function CategoryIcon({ id, ...p }: { id: string } & P) {
  return <Svg {...p}>{GLYPHS[id] ?? GLYPHS.other}</Svg>;
}

/** Rounded square with the category icon, for list rows. */
export function CategoryTile({ id, className = "" }: { id: string; className?: string }) {
  const key = GLYPHS[id] ? id : "other";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl ring-1 ring-white/10 ${TONES[key]} ${className}`}
      title={categoryLabel(key)}
    >
      <CategoryIcon id={key} />
    </span>
  );
}

/** Small pill: icon + label. */
export function CategoryChip({ id }: { id: string }) {
  const key = GLYPHS[id] ? id : "other";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${TONES[key]}`}>
      <CategoryIcon id={key} width={12} height={12} />
      {categoryLabel(key)}
    </span>
  );
}
