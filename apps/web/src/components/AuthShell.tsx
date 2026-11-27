import { LOOP_LEFT, LOOP_RIGHT } from "./Logo";

/**
 * The DEL mark whole and centred on a white disc with two faint halo rings (owner 2026-11-27, option 2). The colours are
 * the brand's own and fixed: the disc is white in both themes, so the mark never changes with light/dark.
 */
export function AuthLogoBadge() {
  return (
    <div className="grid size-[clamp(150px,13vw,184px)] place-items-center rounded-full bg-white shadow-[0_0_0_10px_rgba(255,255,255,0.06),0_0_0_22px_rgba(255,255,255,0.03)]" data-testid="auth-logo-badge">
      <svg viewBox="0 0 120 60" className="h-auto w-[66%]" fill="none" role="img" aria-label="DevOps Easy Learning">
        <path d={LOOP_LEFT} stroke="#4f3fb0" strokeWidth="9" strokeLinecap="round" />
        <path d={LOOP_RIGHT} stroke="#1e9bd7" strokeWidth="9" strokeLinecap="round" />
        <path d="M50,17 L60,30" stroke="#4f3fb0" strokeWidth="9" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function AuthShell({ title, sub, children, aside }: { title: string; sub: string; children: React.ReactNode; aside: React.ReactNode }) {
  return (
    <div className="container-x grid gap-10 py-12 md:py-16 lg:grid-cols-[1fr_1fr] lg:gap-16">
      <div className="mx-auto w-full max-w-md lg:mx-0 lg:justify-self-end">
        <h1 className="font-display text-[2.2rem] font-extrabold leading-tight">{title}</h1>
        <p className="mb-8 mt-2 text-ink-2">{sub}</p>
        {children}
      </div>
      <div className="relative hidden flex-col overflow-hidden rounded-panel bg-stage p-10 text-white lg:flex">
        <div className="relative max-w-sm">{aside}</div>
        <div className="flex flex-1 items-center justify-center pb-4 pt-10">
          <AuthLogoBadge />
        </div>
      </div>
    </div>
  );
}
