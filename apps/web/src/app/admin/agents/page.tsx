"use client";
import Link from "next/link";
import { useState } from "react";
import { Bot, Check, Copy, KeyRound, Loader2, Lock } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { qs } from "@/lib/qs";
import { dateTime } from "@/lib/format";
import { API_URL } from "@/lib/config";
import { PageHead, DataTable } from "@/components/shell/AppShell";
import { Skeleton } from "@/components/Empty";
import { useDebounced } from "@/components/Pager";
import { useToast } from "@/components/Toast";

interface Scope { key: string; description: string }
interface Token {
  id: string; name: string; prefix: string; scopes: string[]; reason: string; createdAt: string; expiresAt: string; lastUsedAt: string | null;
  status: "active" | "revoked" | "expired"; instructor: { name: string; email: string } | null; issuedBy: { name: string } | null; actions: number;
}
interface Activity { id: string; at: string; action: string; status: string; agent: string | null; meta: Record<string, unknown> }
interface Pending { id: string; title: string; status: string; instructor: { name: string }; submittedAt: string | null }

const STATUS: Record<Token["status"], string> = { active: "text-mint", revoked: "text-rose", expired: "text-muted" };

/**
 * Super Admin › AI agents (docs/SUPPORT_SESSIONS_AND_AGENTS.md): scoped, expiring, revocable tokens that let an AI agent
 * (Claude through the MCP server) build courses for ONE instructor. The token is shown once.
 */
export default function AgentsPage() {
  const toast = useToast();
  const scopes = useApi("/admin/agents/scopes", (r) => ({ scopes: (obj(r).scopes as Scope[]) ?? [], maxDays: Number(obj(r).maxDays ?? 30) }));
  const tokens = useApi("/admin/agents/tokens", (r) => (obj(r).items as Token[]) ?? []);
  const activity = useApi("/admin/agents/activity", (r) => (obj(r).items as Activity[]) ?? []);
  const pending = useApi("/admin/agents/pending", (r) => (obj(r).items as Pending[]) ?? []);
  const [issued, setIssued] = useState<{ token: string; name: string; instructor: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function revoke(t: Token) {
    if (!window.confirm(`Revoke “${t.name}”? The agent stops working immediately.`)) return;
    try { await api(`/admin/agents/tokens/${t.id}/revoke`, { method: "POST" }); toast("ok", "Token revoked."); tokens.reload(); } catch (e) { toast("error", errMsg(e)); }
  }
  const mcp = issued ? `claude mcp add del-courses --env DEL_API_URL=${API_URL} --env DEL_AGENT_TOKEN=${issued.token} -- node tools/mcp-server/dist/index.js` : "";

  return (
    <div className="max-w-6xl">
      <PageHead title="AI agents" sub="Let an AI assistant such as Claude build and upload a course for one instructor. Tokens are scoped, expire on their own and can be revoked; the agent never publishes, never sees payments and never gets a password." />

      {issued ? (
        <section className="mb-6 rounded-panel border-2 border-mint bg-surface p-5" aria-labelledby="issued-h" data-testid="token-issued">
          <h2 id="issued-h" className="font-display text-lg font-bold">Token for {issued.instructor}: copy it now</h2>
          <p className="mt-1 text-sm text-ink-2">It is shown only once. Give it to the agent through the MCP server (below) or as <code>Authorization: Bearer …</code>.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-tile border border-line bg-surface-2 px-3 py-2 text-sm [overflow-wrap:anywhere]" data-testid="token-value">{issued.token}</code>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => { void navigator.clipboard?.writeText(issued.token).then(() => setCopied(true)).catch(() => setCopied(false)); }}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? "Copied" : "Copy"}</button>
          </div>
          <p className="mt-4 text-sm font-bold text-ink">Connect Claude Code (from the repository folder):</p>
          <pre className="mt-1 overflow-x-auto rounded-tile border border-line bg-surface-2 p-3 text-xs">{mcp}</pre>
          <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={() => { setIssued(null); setCopied(false); }}>I saved it</button>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <IssueForm scopes={scopes.data?.scopes ?? []} maxDays={scopes.data?.maxDays ?? 30} onIssued={(t) => { setIssued(t); tokens.reload(); activity.reload(); }} />
        <section className="rounded-panel border border-line bg-surface p-5" aria-labelledby="pending-h" data-testid="agent-pending">
          <h2 id="pending-h" className="font-display text-lg font-bold">Waiting for your approval</h2>
          <p className="mt-1 text-sm text-ink-2">Courses an agent submitted. You approve or request changes in the review queue, as for any course.</p>
          {!pending.data ? <Skeleton className="mt-3 h-16" /> : pending.data.length ? (
            <ul className="mt-3 divide-y divide-line">
              {pending.data.map((p) => (
                <li key={p.id} className="py-2.5"><Link href="/admin/review" className="font-bold text-violet hover:underline">{p.title}</Link><span className="block text-sm text-muted">{p.instructor.name}{p.submittedAt ? ` · submitted ${dateTime(p.submittedAt)}` : ""}</span></li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-muted">Nothing waiting.</p>}
        </section>
      </div>

      <section className="mt-6" aria-labelledby="tokens-h">
        <h2 id="tokens-h" className="mb-3 font-display text-lg font-bold">Tokens</h2>
        {!tokens.data ? <Skeleton className="h-40" /> : (
          <DataTable head={["Agent", "Instructor", "Can", "Status", "Expires", "Last used", ""]} min={900} empty={!tokens.data.length ? <p className="px-4 py-10 text-center text-ink-2">No agent tokens yet.</p> : null}>
            {tokens.data.map((t) => (
              <tr key={t.id} data-testid="agent-token-row">
                <td className="px-4 py-3"><span className="block font-bold">{t.name}</span><span className="text-xs text-muted">{t.prefix}… · by {t.issuedBy?.name ?? "?"}</span></td>
                <td className="px-4 py-3">{t.instructor?.name ?? "?"}<span className="block text-xs text-muted">{t.instructor?.email}</span></td>
                <td className="px-4 py-3 text-xs text-ink-2">{t.scopes.join(", ")}</td>
                <td className={`px-4 py-3 font-bold capitalize ${STATUS[t.status]}`}>{t.status}<span className="block text-xs font-normal text-muted">{t.actions} action{t.actions === 1 ? "" : "s"}</span></td>
                <td className="whitespace-nowrap px-4 py-3 text-ink-2">{dateTime(t.expiresAt)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-ink-2">{t.lastUsedAt ? dateTime(t.lastUsedAt) : "Never"}</td>
                <td className="px-4 py-3 text-right">{t.status === "active" ? <button type="button" className="btn btn-outline btn-sm" onClick={() => void revoke(t)} data-testid="revoke-token">Revoke</button> : null}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <section className="mt-6 rounded-panel border border-line bg-surface p-5" aria-labelledby="act-h">
        <h2 id="act-h" className="font-display text-lg font-bold">What agents did</h2>
        {!activity.data ? <Skeleton className="mt-3 h-24" /> : activity.data.length ? (
          <ol className="mt-3 divide-y divide-line text-sm" data-testid="agent-activity">
            {activity.data.slice(0, 50).map((a) => (
              <li key={a.id} className="flex flex-wrap gap-x-3 py-2">
                <span className="w-36 shrink-0 text-muted">{dateTime(a.at)}</span>
                <span className="min-w-0 flex-1"><b className="text-ink">{a.action}</b>{a.meta?.path ? <span className="text-ink-2"> · {String(a.meta.method ?? "")} {String(a.meta.path)}</span> : null}{a.agent ? <span className="text-muted"> · {a.agent}</span> : null}{a.status === "failed" ? <span className="font-bold text-rose"> · failed{a.meta?.error ? ` (${String(a.meta.error)})` : ""}</span> : null}</span>
              </li>
            ))}
          </ol>
        ) : <p className="mt-3 text-sm text-muted">No agent activity yet.</p>}
      </section>
    </div>
  );
}

function IssueForm({ scopes, maxDays, onIssued }: { scopes: Scope[]; maxDays: number; onIssued: (t: { token: string; name: string; instructor: string }) => void }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const found = useApi(dq.length > 1 ? `/admin/people/users${qs({ q: dq, role: "instructor", pageSize: 8 })}` : null, (r) => ((obj(r).items as { id: string; name: string; email: string }[]) ?? []));
  const [who, setWho] = useState<{ id: string; name: string } | null>(null);
  const [name, setName] = useState("Claude course assistant");
  const [chosen, setChosen] = useState<string[]>(["courses:read", "courses:write", "uploads"]);
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function issue() {
    if (!who) return;
    setBusy(true); setErr(null);
    try {
      const r = obj(await api("/admin/agents/tokens", { method: "POST", body: { instructorId: who.id, name: name.trim(), scopes: chosen, days, reason: reason.trim(), code: code.trim() || undefined } }));
      onIssued({ token: String(r.token), name: String(r.name), instructor: who.name });
      setCode(""); setReason("");
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <section className="rounded-panel border border-line bg-surface p-5" aria-labelledby="issue-h" data-testid="issue-token">
      <h2 id="issue-h" className="flex items-center gap-2 font-display text-lg font-bold"><Bot className="size-5 text-violet" aria-hidden="true" />Give an agent access</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="agent-who">Instructor</label>
          {who ? (
            <p className="flex items-center gap-3"><b>{who.name}</b><button type="button" className="btn btn-ghost btn-sm" onClick={() => setWho(null)}>Change</button></p>
          ) : (
            <>
              <input id="agent-who" type="search" className="field" placeholder="Search instructors by name or email" value={q} onChange={(e) => setQ(e.target.value)} data-testid="agent-instructor-search" />
              {found.data?.length ? (
                <ul className="mt-1 divide-y divide-line rounded-tile border border-line">
                  {found.data.map((u) => <li key={u.id}><button type="button" className="w-full px-3 py-2 text-left hover:bg-surface-2" onClick={() => setWho({ id: u.id, name: u.name })}><b>{u.name}</b> <span className="text-sm text-muted">{u.email}</span></button></li>)}
                </ul>
              ) : null}
            </>
          )}
        </div>
        <div><label className="label" htmlFor="agent-name">Agent name</label><input id="agent-name" className="field" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label" htmlFor="agent-days">Expires after</label><select id="agent-days" className="field" value={days} onChange={(e) => setDays(Number(e.target.value))}>{[1, 3, 7, 14, maxDays].filter((d, i, a) => a.indexOf(d) === i && d <= maxDays).map((d) => <option key={d} value={d}>{d} day{d === 1 ? "" : "s"}</option>)}</select></div>
        <fieldset className="sm:col-span-2">
          <legend className="label">What it may do</legend>
          <ul className="grid gap-2 sm:grid-cols-2">
            {scopes.map((s) => (
              <li key={s.key}><label className="flex gap-2.5 text-sm"><input type="checkbox" className="mt-0.5 size-4 accent-[var(--violet)]" checked={chosen.includes(s.key)} onChange={(e) => setChosen((c) => (e.target.checked ? [...c, s.key] : c.filter((x) => x !== s.key)))} /><span><b className="text-ink">{s.key}</b><span className="block text-ink-2">{s.description}</span></span></label></li>
            ))}
          </ul>
        </fieldset>
        <div className="sm:col-span-2"><label className="label" htmlFor="agent-reason">Reason (shown to the instructor)</label><input id="agent-reason" className="field" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Build “Kubernetes basics” from Nadia’s 30 recordings" /></div>
        <div><label className="label" htmlFor="agent-code"><Lock className="mr-1 inline size-3.5" />Your authenticator code</label><input id="agent-code" className="field tabular-nums" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="6 digits" /></div>
      </div>
      {err ? <p className="mt-3 text-sm font-bold text-rose" role="alert">{err}</p> : null}
      <div className="mt-4 flex justify-end">
        <button type="button" className="btn btn-primary" disabled={busy || !who || !chosen.length || reason.trim().length < 5 || name.trim().length < 2} onClick={() => void issue()} data-testid="issue-token-submit">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}Create token
        </button>
      </div>
    </section>
  );
}
