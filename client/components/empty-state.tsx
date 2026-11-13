import type { ComponentType, ReactNode, SVGProps } from "react";

export function EmptyState({
  icon: Icon,
  title,
  text,
  children,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="surface flex flex-col items-center justify-center px-8 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-jade-400/25 to-gold-400/10 text-jade-300 ring-1 ring-white/10">
        <Icon width={26} height={26} />
      </span>
      <h3 className="mt-5 text-lg font-semibold tracking-tight text-ivory-50">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-300">{text}</p>
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="surface divide-y divide-white/[0.06]" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-4 px-5 py-4">
          <span className="h-11 w-11 rounded-full bg-white/[0.07]" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-32 rounded bg-white/[0.07]" />
            <div className="h-3 w-20 rounded bg-white/[0.05]" />
          </div>
        </div>
      ))}
    </div>
  );
}
