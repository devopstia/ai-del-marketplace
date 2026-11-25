"use client";
import { useRef, useState } from "react";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { api, errMsg, uploadFile } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { obj } from "@/lib/normalize";
import { Avatar } from "../Avatar";

export const CATEGORIES: [string, string][] = [
  ["account", "Account and sign-in"],
  ["payments_refunds", "Payments and refunds"],
  ["course_content", "Course content"],
  ["video_playback", "Video playback"],
  ["technical", "Technical problem"],
  ["instructor", "Question for an instructor"],
  ["certificates", "Certificates"],
  ["bug_report", "Something is broken"],
  ["feature_request", "Idea or suggestion"],
  ["other", "Something else"],
];
export const categoryLabel = (c: string) => CATEGORIES.find(([k]) => k === c)?.[1] ?? c;
export const STATUS: Record<string, [string, string]> = {
  new: ["New", "bg-cyan-soft text-cyan-ink"],
  open: ["Open", "bg-violet-soft text-violet"],
  waiting_user: ["Waiting for you", "bg-amber-soft text-amber"],
  resolved: ["Resolved", "bg-mint-soft text-mint"],
  closed: ["Closed", "bg-surface-2 text-muted"],
};
export const STAFF_STATUS: Record<string, string> = { waiting_user: "Waiting for requester" };
export const PRIORITY: Record<string, string> = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };

export function StatusPill({ status, staff = false }: { status: string; staff?: boolean }) {
  const [label, cls] = STATUS[status] ?? [status, "bg-surface-2 text-muted"];
  return <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>{staff ? STAFF_STATUS[status] ?? label : label}</span>;
}

export interface Attachment { id: string; name: string; mime: string; sizeBytes: number; url: string }
export interface Message { id: string; kind: string; body: string; staff: boolean; internal: boolean; createdAt: string; author: { id: string | null; name: string; avatarUrl: string | null } | null; attachments: Attachment[] }
export interface Ticket {
  number: string; subject: string; category: string; priority: string; status: string; awaiting: string | null;
  requester: { id: string; name: string; email: string; avatarUrl: string | null; roles: string[] };
  assignedTo: { id: string; name: string } | null; createdAt: string; updatedAt: string;
  context?: Record<string, unknown> | null; course: { id: string; slug: string; title: string } | null; order: { id: string; totalCents: number; status: string } | null;
  canReopen: boolean; messages: Message[]; lastMessage: { preview: string; at: string; staff: boolean } | null;
}
const arr = (x: unknown) => (Array.isArray(x) ? x : []);
export function toTicket(r: unknown): Ticket {
  const o = obj(r);
  return { ...(o as unknown as Ticket), messages: arr(o.messages) as Message[], context: (o.context as Record<string, unknown>) ?? null, lastMessage: (o.lastMessage as Ticket["lastMessage"]) ?? null };
}
export const toTickets = (r: unknown) => arr(obj(r).items).map(toTicket);

export const when = (d: string) => new Date(d).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
const size = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** The conversation. Plain text with line breaks (never HTML); staff-only notes are marked. */
export function Thread({ messages, viewerIsStaff }: { messages: Message[]; viewerIsStaff: boolean }) {
  return (
    <ol className="space-y-4" data-testid="ticket-thread">
      {messages.map((m) => m.kind === "system" ? (
        <li key={m.id} className="flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" /><span>{m.body} · {when(m.createdAt)}</span><span className="h-px flex-1 bg-line" /></li>
      ) : (
        <li key={m.id} className={`rounded-tile border p-4 ${m.internal ? "border-amber/50 bg-amber-soft" : m.staff ? "border-violet/40 bg-surface" : "border-line bg-surface"}`}>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <Avatar name={m.author?.name ?? "DEL Support"} src={m.author?.avatarUrl} size={28} />
            <b className="text-sm text-ink">{m.author?.name ?? "DEL Support"}</b>
            {m.staff ? <span className="rounded-full bg-violet-soft px-2 py-0.5 text-[0.7rem] font-bold text-violet">Support</span> : null}
            {m.internal ? <span className="rounded-full bg-amber px-2 py-0.5 text-[0.7rem] font-bold text-[#1f1500]">Internal note</span> : null}
            <span className="ml-auto text-xs text-muted">{when(m.createdAt)}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-[0.95rem] text-ink">{m.body}</p>
          {m.attachments.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {m.attachments.map((a) => a.mime.startsWith("image/") ? (
                <li key={a.id}><a href={`${API_URL}${a.url}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-line hover:border-violet" title={a.name}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${API_URL}${a.url}`} alt={a.name} className="h-24 w-36 object-cover" loading="lazy" />
                </a></li>
              ) : (
                <li key={a.id}><a href={`${API_URL}${a.url}`} className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-ink hover:border-violet"><FileText className="size-4 text-muted" />{a.name}<span className="text-xs text-muted">{size(a.sizeBytes)}</span></a></li>
              ))}
            </ul>
          ) : null}
          {viewerIsStaff && m.internal ? <p className="mt-2 text-xs text-ink-2">Only support staff see this note.</p> : null}
        </li>
      ))}
    </ol>
  );
}

export interface Uploaded { key: string; name: string; mime: string; sizeBytes: number }
const TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

/** Text box with up to three private attachments (uploaded straight to storage before sending). */
export function Composer({ label, placeholder, busy, onSend, submitLabel, children, minRows = 4 }: { label: string; placeholder?: string; busy: boolean; onSend: (body: string, files: Uploaded[]) => Promise<boolean>; submitLabel: string; children?: React.ReactNode; minRows?: number }) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<Uploaded[]>([]);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function add(list: FileList | null) {
    if (!list) return;
    setErr(null);
    for (const f of Array.from(list)) {
      if (files.length >= 3) { setErr("Attach up to 3 files."); break; }
      if (!TYPES.includes(f.type)) { setErr("Attach PNG, JPG, WebP images or a PDF."); continue; }
      if (f.size > 5 * 1024 * 1024) { setErr("Files can be up to 5 MB."); continue; }
      setUploading(true);
      try {
        const r = obj(await api("/support/uploads", { method: "POST", body: { name: f.name, contentType: f.type, sizeBytes: f.size } }));
        await uploadFile(String(r.uploadUrl), f, () => {}, "PUT", (obj(r.headers) as Record<string, string>) ?? {});
        setFiles((x) => [...x, { key: String(r.key), name: f.name, mime: f.type, sizeBytes: f.size }]);
      } catch (e) { setErr(errMsg(e)); } finally { setUploading(false); }
    }
    if (input.current) input.current.value = "";
  }

  return (
    <form className="grid gap-3" onSubmit={async (e) => { e.preventDefault(); if (await onSend(body, files)) { setBody(""); setFiles([]); } }}>
      <label className="grid gap-1.5"><span className="label !mb-0">{label}</span>
        <textarea className="field" rows={minRows} value={body} onChange={(e) => setBody(e.target.value)} placeholder={placeholder} maxLength={5000} data-testid="composer-text" />
      </label>
      {files.length ? (
        <ul className="flex flex-wrap gap-2">{files.map((f) => (
          <li key={f.key} className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-sm text-ink"><Paperclip className="size-3.5 text-muted" />{f.name}
            <button type="button" className="text-muted hover:text-rose" aria-label={`Remove ${f.name}`} onClick={() => setFiles((x) => x.filter((y) => y.key !== f.key))}><X className="size-3.5" /></button></li>
        ))}</ul>
      ) : null}
      {err ? <p className="text-sm font-bold text-rose" role="alert">{err}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <input ref={input} type="file" accept={TYPES.join(",")} multiple className="sr-only" id={`att-${label}`} onChange={(e) => void add(e.target.files)} />
        <label htmlFor={`att-${label}`} className="btn btn-ghost btn-sm cursor-pointer">{uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}Attach screenshot or PDF</label>
        <button className="btn btn-primary ml-auto" disabled={busy || uploading || !body.trim()} data-testid="composer-send">{busy ? <Loader2 className="size-4 animate-spin" /> : null}{submitLabel}</button>
      </div>
    </form>
  );
}

/** What the browser can tell support about where the problem happened (sent with a new ticket). */
export function browserContext(from: string | null): Record<string, string | boolean | number | null> {
  const ua = navigator.userAgent;
  const browser = /edg\//i.test(ua) ? "Edge" : /firefox|fxios/i.test(ua) ? "Firefox" : /chrome|crios/i.test(ua) ? "Chrome" : /safari/i.test(ua) ? "Safari" : "Other";
  const os = /iphone|ipad/i.test(ua) ? "iOS" : /android/i.test(ua) ? "Android" : /windows/i.test(ua) ? "Windows" : /mac os/i.test(ua) ? "macOS" : /linux/i.test(ua) ? "Linux" : "Other";
  return {
    browser, os, userAgent: ua.slice(0, 300), page: from, screen: `${window.screen.width}x${window.screen.height}`,
    installedApp: window.matchMedia("(display-mode: standalone)").matches, language: navigator.language,
  };
}
