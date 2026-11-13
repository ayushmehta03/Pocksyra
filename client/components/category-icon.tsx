import type { ReactNode, SVGProps } from "react";
import { categoryLabel } from "@/lib/categories";

type P = SVGProps<SVGSVGElement>;

function Svg({ children, ...p }: P & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
      {children}
    </svg>
  );
}

// Soft fill behind the strokes gives each icon a light duotone look.
const F = { fill: "currentColor", fillOpacity: 0.16 } as const;

const GLYPHS: Record<string, ReactNode> = {
  food: (
    <>
      <path d="M7 3v7.5M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10" />
      <path d="M17.5 21V3C15 4.4 13.7 7.2 13.7 11H17.5" {...F} />
    </>
  ),
  groceries: (
    <>
      <path d="M3 4h2.3l2.1 11.2h10.2L19.5 7H6.3" {...F} />
      <circle cx="9.2" cy="19.4" r="1.3" />
      <circle cx="16.8" cy="19.4" r="1.3" />
    </>
  ),
  transport: (
    <>
      <path d="M5 16.5V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v8.5z" {...F} />
      <path d="M5 12h14M7.5 16.5V20M16.5 16.5V20" />
      <circle cx="8.8" cy="14.3" r=".5" fill="currentColor" />
      <circle cx="15.2" cy="14.3" r=".5" fill="currentColor" />
    </>
  ),
  rent: (
    <>
      <path d="M3.5 11 12 3.5 20.5 11" />
      <path d="M5.5 9.8V20h13V9.8L12 4.2z" {...F} />
      <path d="M10 20v-5.5h4V20" />
    </>
  ),
  utilities: <path d="M13.2 2.5 4.5 13.8h6.6l-.9 7.7 8.7-11.3h-6.6z" {...F} />,
  entertainment: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" {...F} />
      <path d="m10.2 9 4.6 3-4.6 3z" />
    </>
  ),
  travel: <path d="M21 3 3 10.4l6.3 2.3L11.6 19 14 14l5-4.4z M9.3 12.7 14 14" {...F} />,
  shopping: (
    <>
      <path d="M5 8h14l-1.1 12H6.1z" {...F} />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </>
  ),
  health: (
    <>
      <path d="M12 20.5s-7.5-4.6-7.5-10.4A4.1 4.1 0 0 1 12 7.8a4.1 4.1 0 0 1 7.5 2.3c0 5.8-7.5 10.4-7.5 10.4z" {...F} />
      <path d="M12 10v4.2M9.9 12.1h4.2" />
    </>
  ),
  other: (
    <>
      <circle cx="6" cy="12" r="1.4" {...F} />
      <circle cx="12" cy="12" r="1.4" {...F} />
      <circle cx="18" cy="12" r="1.4" {...F} />
    </>
  ),
};

// Written out in full so Tailwind can see every class.
const TONES: Record<string, { tile: string; chip: string; bar: string; dot: string }> = {
  food: { tile: "from-orange-400/30 to-orange-400/5 text-orange-300", chip: "bg-orange-400/15 text-orange-300", bar: "bg-orange-400", dot: "bg-orange-400" },
  groceries: { tile: "from-lime-400/30 to-lime-400/5 text-lime-300", chip: "bg-lime-400/15 text-lime-300", bar: "bg-lime-400", dot: "bg-lime-400" },
  transport: { tile: "from-sky-400/30 to-sky-400/5 text-sky-300", chip: "bg-sky-400/15 text-sky-300", bar: "bg-sky-400", dot: "bg-sky-400" },
  rent: { tile: "from-violet-400/30 to-violet-400/5 text-violet-300", chip: "bg-violet-400/15 text-violet-300", bar: "bg-violet-400", dot: "bg-violet-400" },
  utilities: { tile: "from-yellow-400/30 to-yellow-400/5 text-yellow-300", chip: "bg-yellow-400/15 text-yellow-300", bar: "bg-yellow-400", dot: "bg-yellow-400" },
  entertainment: { tile: "from-pink-400/30 to-pink-400/5 text-pink-300", chip: "bg-pink-400/15 text-pink-300", bar: "bg-pink-400", dot: "bg-pink-400" },
  travel: { tile: "from-cyan-400/30 to-cyan-400/5 text-cyan-300", chip: "bg-cyan-400/15 text-cyan-300", bar: "bg-cyan-400", dot: "bg-cyan-400" },
  shopping: { tile: "from-fuchsia-400/30 to-fuchsia-400/5 text-fuchsia-300", chip: "bg-fuchsia-400/15 text-fuchsia-300", bar: "bg-fuchsia-400", dot: "bg-fuchsia-400" },
  health: { tile: "from-rose-400/30 to-rose-400/5 text-rose-300", chip: "bg-rose-400/15 text-rose-300", bar: "bg-rose-400", dot: "bg-rose-400" },
  other: { tile: "from-white/15 to-white/[0.03] text-ink-300", chip: "bg-white/[0.07] text-ink-300", bar: "bg-ink-400", dot: "bg-ink-400" },
};

const known = (id: string) => (GLYPHS[id] ? id : "other");

/** Tailwind classes for charts: `bar` for a bar segment, `dot` for a legend dot. */
export const categoryTone = (id: string) => TONES[known(id)]!;

export function CategoryIcon({ id, ...p }: { id: string } & P) {
  return <Svg {...p}>{GLYPHS[known(id)]}</Svg>;
}

/** Rounded square with the category icon, for list rows. */
export function CategoryTile({ id, className = "" }: { id: string; className?: string }) {
  const key = known(id);
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-inner ring-1 ring-white/10 ${TONES[key]!.tile} ${className}`}
      title={categoryLabel(key)}
    >
      <CategoryIcon id={key} />
    </span>
  );
}

/** Small pill: icon + label. */
export function CategoryChip({ id }: { id: string }) {
  const key = known(id);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${TONES[key]!.chip}`}>
      <CategoryIcon id={key} width={12} height={12} />
      {categoryLabel(key)}
    </span>
  );
}
