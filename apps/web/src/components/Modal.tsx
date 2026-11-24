"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto w-[min(100%-1.5rem,${wide ? "960px" : "560px"})] max-h-[92dvh] rounded-panel border border-line bg-surface p-0 text-ink shadow-float backdrop:bg-[rgba(8,10,25,.7)] backdrop:backdrop-blur-sm`}
      style={{ width: `min(100% - 1.5rem, ${wide ? 960 : 560}px)` }}
      aria-label={title}
    >
      {open ? (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
            <h2 className="truncate font-display text-lg font-bold">{title}</h2>
            <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={onClose} aria-label="Close"><X className="size-5" /></button>
          </div>
          <div className="overflow-y-auto">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}
