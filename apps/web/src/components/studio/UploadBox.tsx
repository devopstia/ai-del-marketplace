"use client";
import { useRef, useState } from "react";
import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import { errMsg } from "@/lib/api";

/** File picker with drag-and-drop and a real progress bar. */
export function UploadBox({ accept, label, hint, onFile, disabled, compact = false }: { accept: string; label: string; hint: string; onFile: (f: File, progress: (p: number) => void) => Promise<void>; disabled?: boolean; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [p, setP] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  async function handle(f?: File) {
    if (!f) return;
    setErr(null); setDone(null); setP(0);
    try {
      await onFile(f, setP);
      setDone(f.name);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setP(null);
      if (input.current) input.current.value = "";
    }
  }
  const busy = p !== null;
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled && !busy) void handle(e.dataTransfer.files[0]); }}
      className={`rounded-tile border-[1.5px] border-dashed ${over ? "border-violet bg-violet-soft" : "border-line-strong"} ${compact ? "p-3" : "p-6"}`}
    >
      <div className={`flex ${compact ? "items-center gap-3" : "flex-col items-center text-center"}`}>
        {!compact ? <UploadCloud className="size-8 text-violet" /> : null}
        <div className={compact ? "min-w-0 flex-1" : "mt-2"}>
          <p className="text-sm font-bold">{label}</p>
          <p className="text-xs text-muted">{hint}</p>
        </div>
        <button type="button" className={`btn btn-outline btn-sm ${compact ? "" : "mt-3"}`} disabled={disabled || busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}{busy ? "Uploading" : "Choose file"}
        </button>
        <input ref={input} type="file" accept={accept} className="sr-only" tabIndex={-1} aria-label={label} onChange={(e) => void handle(e.target.files?.[0])} />
      </div>
      {busy ? (
        <div className="mt-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((p ?? 0) * 100)} aria-label="Upload progress">
          <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-gradient-to-r from-violet to-cyan transition-[width]" style={{ width: `${Math.round((p ?? 0) * 100)}%` }} /></div>
          <p className="mt-1 text-xs tabular-nums text-muted">{Math.round((p ?? 0) * 100)}% uploaded</p>
        </div>
      ) : null}
      {done ? <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-mint"><CheckCircle2 className="size-4" />Uploaded {done}</p> : null}
      {err ? <p role="alert" className="mt-2 text-xs font-bold text-rose">{err}</p> : null}
    </div>
  );
}
