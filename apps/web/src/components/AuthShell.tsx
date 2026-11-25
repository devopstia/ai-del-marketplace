import { LOOP_FULL } from "./Logo";

export function AuthShell({ title, sub, children, aside }: { title: string; sub: string; children: React.ReactNode; aside: React.ReactNode }) {
  return (
    <div className="container-x grid gap-10 py-12 md:py-16 lg:grid-cols-[1fr_1fr] lg:gap-16">
      <div className="mx-auto w-full max-w-md lg:mx-0 lg:justify-self-end">
        <h1 className="font-display text-[2.2rem] font-extrabold leading-tight">{title}</h1>
        <p className="mb-8 mt-2 text-ink-2">{sub}</p>
        {children}
      </div>
      <div className="relative hidden overflow-hidden rounded-panel bg-stage p-10 text-white lg:block">
        <svg viewBox="0 0 120 60" className="absolute -bottom-10 -right-20 w-[130%] opacity-30" fill="none" aria-hidden="true">
          <path d={LOOP_FULL} stroke="#58c3f2" strokeWidth="1.5" />
          <path d={LOOP_FULL} stroke="#9d8fff" strokeWidth="1.5" transform="translate(6 3) scale(.9)" />
        </svg>
        <div className="relative max-w-sm">{aside}</div>
      </div>
    </div>
  );
}
