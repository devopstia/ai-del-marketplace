"use client";
/** Submits its parent GET form when any radio/select inside changes, so filters apply instantly with JS and still work without it. */
export function AutoSubmit({ children, className = "", action }: { children: React.ReactNode; className?: string; action: string }) {
  return (
    <form action={action} className={className} onChange={(e) => (e.currentTarget as HTMLFormElement).requestSubmit()}>
      {children}
    </form>
  );
}
