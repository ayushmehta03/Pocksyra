export function PageHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="space-y-2">
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">{eyebrow}</p>}
      <h1 className="text-3xl font-semibold tracking-tight text-fg sm:text-4xl">{title}</h1>
      {subtitle && <p className="max-w-xl text-[15px] leading-relaxed text-fg-2">{subtitle}</p>}
    </div>
  );
}
