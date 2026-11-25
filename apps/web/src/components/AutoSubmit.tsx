"use client";
/**
 * Submits its parent GET form when any radio/checkbox/select inside changes, so filters apply instantly with JS and still
 * work without it. Empty values ("All levels", "Any price") are left out of the address instead of showing as `level=`.
 */
export function AutoSubmit({ children, className = "", action }: { children: React.ReactNode; className?: string; action: string }) {
  return (
    <form
      action={action}
      className={className}
      onChange={(e) => (e.currentTarget as HTMLFormElement).requestSubmit()}
      onSubmit={(e) => {
        e.preventDefault();
        const params = new URLSearchParams();
        new FormData(e.currentTarget).forEach((v, k) => { if (typeof v === "string" && v !== "") params.append(k, v); });
        const q = params.toString();
        window.location.assign(q ? `${action}?${q}` : action);
      }}
    >
      {children}
    </form>
  );
}
