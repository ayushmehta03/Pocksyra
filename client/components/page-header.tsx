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
    <div className="animate-fade-up space-y-2">
      {eyebrow && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-500">{eyebrow}</p>
      )}
      <h1 className="font-display text-4xl tracking-tight text-ink-900 sm:text-5xl">{title}</h1>
      {subtitle && <p className="max-w-xl text-[15px] text-ink-500">{subtitle}</p>}
    </div>
  );
}
