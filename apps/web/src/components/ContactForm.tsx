"use client";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, X } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { obj } from "@/lib/normalize";
import { useAuth } from "./AuthProvider";
import { SUPPORT_EMAIL } from "./SocialLinks";

const TOPICS: [string, string][] = [["general", "General question"], ["courses", "A course or its content"], ["payment", "Payment or receipt"], ["account", "Account or sign-in"], ["instructor", "Teaching on DEL"], ["full_program", "The full training program"], ["technical", "Something isn’t working"]];
const MAX_FILES = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Contact page form: sends the message (and up to 3 screenshots) to DEL support by email. */
export function ContactForm() {
  const { me } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("general");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [hp, setHp] = useState("");
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- prefill once the session is known
  useEffect(() => { if (me) { setName((n) => n || me.name); setEmail((e) => e || me.email); } }, [me]);
  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.url)), [files]);

  function add(list: FileList | File[]) {
    setErr(null);
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!TYPES.includes(f.type)) { setErr(`${f.name}: attach PNG, JPG or WebP images.`); continue; }
      if (f.size > MAX_BYTES) { setErr(`${f.name} is larger than 5 MB.`); continue; }
      if (next.length >= MAX_FILES) { setErr(`Attach up to ${MAX_FILES} images.`); break; }
      next.push({ file: f, url: URL.createObjectURL(f) });
    }
    setFiles(next);
  }

  if (sent) {
    return (
      <div className="panel p-8" role="status" data-testid="contact-sent">
        <CheckCircle2 className="size-10 text-mint" aria-hidden="true" />
        <h2 className="mt-4 font-display text-2xl font-extrabold">Message sent</h2>
        <p className="mt-2 text-ink-2">Thanks, {name.split(" ")[0]}. Your reference is <b className="text-ink">{sent}</b>. We sent a copy to <b className="text-ink">{email}</b> and reply from {SUPPORT_EMAIL}, usually within one working day.</p>
        <button type="button" className="btn btn-outline mt-6" onClick={() => { setSent(null); setSubject(""); setBody(""); setFiles([]); }}>Send another message</button>
      </div>
    );
  }

  return (
    <form className="panel space-y-5 p-6 sm:p-8" data-testid="contact-form" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true); setErr(null);
      try {
        const fd = new FormData();
        fd.set("name", name.trim()); fd.set("email", email.trim()); fd.set("topic", topic); fd.set("subject", subject.trim()); fd.set("body", body.trim());
        if (hp) fd.set("website", hp);
        files.forEach((f) => fd.append("images", f.file, f.file.name));
        const r = obj(await api("/contact", { method: "POST", body: fd }));
        setSent(String(r.ref ?? ""));
      } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
    }}>
      <h2 className="font-display text-xl font-bold">Send us a message</h2>
      <div className="grid gap-5 sm:grid-cols-2">
        <div><label className="label" htmlFor="c-name">Your name</label><input id="c-name" className="field" required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label" htmlFor="c-email">Email</label><input id="c-email" type="email" className="field" required maxLength={200} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div><label className="label" htmlFor="c-topic">Topic</label><select id="c-topic" className="field" value={topic} onChange={(e) => setTopic(e.target.value)}>{TOPICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div><label className="label" htmlFor="c-subject">Subject</label><input id="c-subject" className="field" required minLength={3} maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
      </div>
      <div><label className="label" htmlFor="c-body">Message</label><textarea id="c-body" className="field" required minLength={10} maxLength={5000} rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What happened, and what you expected." /></div>
      {/* honeypot: hidden from people and screen readers */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden"><label htmlFor="c-website">Website</label><input id="c-website" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} /></div>
      <div>
        <p className="label" id="c-files">Screenshots (optional)</p>
        <div
          role="button" tabIndex={0} aria-labelledby="c-files" aria-describedby="c-files-hint"
          onClick={() => input.current?.click()} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click(); } }}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
          className={`flex cursor-pointer items-center gap-3 rounded-tile border-2 border-dashed px-4 py-4 text-sm ${drag ? "border-violet bg-violet-soft" : "border-line-strong hover:border-violet"}`}
          data-testid="contact-drop">
          <ImagePlus className="size-6 shrink-0 text-violet" aria-hidden="true" />
          <span className="text-ink-2"><b className="text-ink">Add images</b> or drop them here</span>
        </div>
        <p id="c-files-hint" className="hint">Up to 3 images, PNG, JPG or WebP, 5 MB each.</p>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ""; }} data-testid="contact-file" />
        {files.length ? (
          <ul className="mt-3 flex flex-wrap gap-3">
            {files.map((f, i) => (
              <li key={f.url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={f.file.name} className="size-20 rounded-lg border border-line object-cover" />
                <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.file.name}`} className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full border border-line bg-surface text-ink shadow-lift hover:text-rose"><X className="size-3.5" /></button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {err ? <p className="text-sm font-bold text-rose" role="alert">{err}</p> : null}
      <div className="flex flex-wrap items-center gap-4">
        <button className="btn btn-primary" disabled={busy} data-testid="contact-submit">{busy ? <Loader2 className="size-4 animate-spin" /> : null}Send message</button>
        <p className="text-xs text-muted">Goes to {SUPPORT_EMAIL}. We use your details only to reply.</p>
      </div>
    </form>
  );
}
