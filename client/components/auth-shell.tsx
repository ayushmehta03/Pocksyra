import type { ReactNode } from "react";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold ${
          light ? "bg-white/15 text-white" : "bg-emerald-600 text-white"
        }`}
      >
        P
      </span>
      <span className={`text-lg font-semibold tracking-tight ${light ? "text-white" : "text-slate-900"}`}>
        Pocksyra
      </span>
    </div>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 p-12 text-white lg:flex">
        <Logo light />
        <div className="space-y-6">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Split bills.
            <br />
            Keep the friendships.
          </h2>
          <ul className="space-y-3 text-emerald-50/90">
            <li className="flex gap-3">
              <span aria-hidden>✓</span> Add an expense in seconds, scan the receipt
            </li>
            <li className="flex gap-3">
              <span aria-hidden>✓</span> Always know who owes whom
            </li>
            <li className="flex gap-3">
              <span aria-hidden>✓</span> Settle up without the awkward texts
            </li>
          </ul>
        </div>
        <p className="text-sm text-emerald-100/70">© {new Date().getFullYear()} Pocksyra</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
          {children}
          <p className="text-center text-sm text-slate-500">{footer}</p>
        </div>
      </main>
    </div>
  );
}
