"use client";
import { useState } from "react";
import { Check, ImageOff, Mail, RotateCcw } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { qs } from "@/lib/qs";
import { obj } from "@/lib/normalize";
import { bytes, dateTime } from "@/lib/format";
import { API_URL } from "@/lib/config";
import { PageHead } from "@/components/shell/AppShell";
import { Empty, Skeleton } from "@/components/Empty";
import { Pager } from "@/components/Pager";
import { useToast } from "@/components/Toast";

interface Msg { id: string; ref: string; name: string; email: string; topic: string; subject: string; body: string; status: "new" | "handled"; createdAt: string; userId: string | null; attachments: { name: string; mime: string; sizeBytes: number; url: string }[] }
const TOPIC: Record<string, string> = { general: "General", courses: "Courses", payment: "Payment", account: "Account", instructor: "Teaching", full_program: "Full program", technical: "Technical" };

/** Screenshot preview; a file that can't be shown as an image becomes a named file tile (still opens). */
function Attachment({ href, name, size }: { href: string; name: string; size: number }) {
  const [broken, setBroken] = useState(false);
  return (
    <a href={href} target="_blank" rel="noopener" title={name} className="group block w-36">
      {broken ? (
        <span className="flex h-24 flex-col items-center justify-center gap-1 rounded-lg border border-line bg-surface-2 px-2 text-center group-hover:border-violet">
          <ImageOff className="size-5 text-muted" aria-hidden="true" />
          <span className="w-full truncate text-xs font-bold text-ink">{name}</span>
          <span className="text-[11px] text-muted">{bytes(size)} · open</span>
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={href} alt={name} onError={() => setBroken(true)} className="h-24 w-36 rounded-lg border border-line object-cover group-hover:border-violet" />
      )}
    </a>
  );
}

/** Contact page messages (also emailed to support@devopseasylearning.com, with the screenshots). */
export default function ContactMessages() {
  const toast = useToast();
  const [tab, setTab] = useState<"new" | "handled">("new");
  const [page, setPage] = useState(1);
  const { data, error, reload } = useApi(`/admin/contact${qs({ status: tab, page, pageSize: 20 })}`, (r) => obj(r) as unknown as { items: Msg[]; total: number; page: number; pageSize: number; newCount: number });
  async function mark(m: Msg, status: "new" | "handled") {
    try { await api(`/admin/contact/${m.id}`, { method: "PATCH", body: { status } }); reload(); } catch (e) { toast("error", errMsg(e)); }
  }
  return (
    <>
      <PageHead title="Contact messages" sub="Messages from the Contact page. Each one is also emailed to support@devopseasylearning.com; reply from the inbox, then mark it handled here." />
      <div role="tablist" className="mb-5 flex gap-1 border-b border-line">
        {([["new", `New${data?.newCount ? ` (${data.newCount})` : ""}`], ["handled", "Handled"]] as const).map(([k, l]) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => { setTab(k); setPage(1); }} className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-bold ${tab === k ? "border-violet text-ink" : "border-transparent text-muted hover:text-ink"}`}>{l}</button>
        ))}
      </div>
      {error ? <p className="text-rose">{error}</p> : null}
      {!data && !error ? <Skeleton className="h-64" /> : null}
      {data && !data.items.length ? <Empty icon={Mail} title={tab === "new" ? "No new messages" : "Nothing handled yet"} body="Messages sent from the Contact page appear here." /> : null}
      {data && data.items.length ? (
        <>
          <ul className="space-y-3">
            {data.items.map((m) => (
              <li key={m.id} className="rounded-tile border border-line bg-surface p-5" data-testid="contact-message">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-muted">{m.ref} · {TOPIC[m.topic] ?? m.topic} · {dateTime(m.createdAt)}{m.userId ? " · signed in" : ""}</p>
                    <h2 className="mt-1 font-display text-lg font-bold">{m.subject}</h2>
                    <p className="text-sm text-ink-2">{m.name} · <a className="link" href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject} [${m.ref}]`)}`}>{m.email}</a></p>
                  </div>
                  {m.status === "new"
                    ? <button type="button" className="btn btn-outline btn-sm" onClick={() => mark(m, "handled")}><Check className="size-4" />Mark handled</button>
                    : <button type="button" className="btn btn-ghost btn-sm" onClick={() => mark(m, "new")}><RotateCcw className="size-4" />Reopen</button>}
                </div>
                <p className="mt-3 whitespace-pre-line text-ink-2">{m.body}</p>
                {m.attachments.length ? (
                  <ul className="mt-4 flex flex-wrap gap-3">
                    {m.attachments.map((a) => (
                      <li key={a.url}>
                        <Attachment href={`${API_URL}${a.url}`} name={a.name} size={a.sizeBytes} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} noun="messages" />
        </>
      ) : null}
    </>
  );
}
