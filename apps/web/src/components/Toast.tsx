"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";

type Toast = { id: number; kind: "ok" | "error"; text: string };
const Ctx = createContext<(kind: Toast["kind"], text: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, kind, text }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 5000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(max(1rem,env(safe-area-inset-bottom))+var(--assist-bar,0px))] z-[80] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="pop-in pointer-events-auto flex max-w-md items-start gap-3 rounded-tile border border-line bg-surface px-4 py-3 text-sm shadow-float">
            {t.kind === "ok" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-mint" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose" />}
            <span className="flex-1 text-ink">{t.text}</span>
            <button type="button" aria-label="Dismiss" className="text-muted hover:text-ink" onClick={() => setItems((x) => x.filter((i) => i.id !== t.id))}>
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
