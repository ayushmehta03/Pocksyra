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
    <div className="animate-fade-up space-y-3">
      {eyebrow && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-jade-300">{eyebrow}</p>
      )}
      <h1 className="text-3xl font-semibold tracking-tight text-ivory-50 sm:text-4xl">{title}</h1>
      {subtitle && <p className="max-w-xl text-[15px] leading-relaxed text-ink-300">{subtitle}</p>}
    </div>
  );
}
