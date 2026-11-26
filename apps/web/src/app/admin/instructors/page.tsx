"use client";
import { useState } from "react";
import { ChevronDown, ExternalLink, Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { qs } from "@/lib/qs";
import { obj } from "@/lib/normalize";
import { date } from "@/lib/format";
import { PageHead } from "@/components/shell/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Avatar } from "@/components/Avatar";
import { Skeleton } from "@/components/Empty";
import { Pager, useDebounced } from "@/components/Pager";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";
import { TermsDialog } from "@/components/admin/TermsDialog";
import { OfficialBadge } from "@/components/OfficialBadge";
import { canDo } from "@/lib/studios";
import type { AdminInstructor } from "@/lib/types";

interface App {
  userId: string; name: string; email: string; memberSince: string; headline: string; bio: string; website: string | null; expertise: string[]; experience: string; plannedCourses: string; extraInfo: string;
  status: "pending" | "under_review" | "needs_info" | "approved" | "rejected"; reviewNote: string | null; appliedAt: string; reviewedAt: string | null; reviewedBy: { name: string } | null; courses: number;
  commissionBps: number | null; payToPlatform: boolean; payoutsEnabled: boolean; official: boolean;
}
const TABS = [["open", "To review"], ["approved", "Instructors"], ["official", "Official DEL"], ["rejected", "Rejected"]] as const;

/** Super Admin Studio › People › Instructor applications (owner 2026-11-25). */
export default function InstructorApplications() {
  const { me } = useAuth();
  const toast = useToast();
  const reviewer = canDo(me, "instructors.review");
  const superAdmin = !!me?.roles.includes("super_admin");
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("open");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounced(q.trim());
  const { data, error, reload } = useApi(`/admin/people/applications${qs({ status: tab === "official" ? "approved" : tab, kind: tab === "official" ? "official" : undefined, q: dq.length > 1 ? dq : undefined, page, pageSize: 20 })}`, (r) => obj(r) as unknown as { items: App[]; total: number; page: number; pageSize: number; counts: Record<string, number> });
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [terms, setTerms] = useState<AdminInstructor | null>(null);
  const settings = useApi(superAdmin ? "/admin/settings" : null, (r) => Number((r as { commission_bps?: number }).commission_bps ?? 2000));
  const defaultShare = (10000 - (settings.data ?? 2000)) / 100;
  const counts = data?.counts ?? {};
  const openCount = (counts.pending ?? 0) + (counts.under_review ?? 0) + (counts.needs_info ?? 0);

  async function decide(a: App, decision: "under_review" | "needs_info" | "approved" | "rejected") {
    const note = a.status === "approved" && decision === "rejected" ? window.prompt("Why is instructor access removed? They receive this note.")?.trim() : notes[a.userId]?.trim();
    if ((decision === "needs_info" || decision === "rejected") && !note) { toast("error", "Write a note for the applicant first."); return; }
    setBusy(a.userId + decision);
    try {
      await api(`/admin/people/applications/${a.userId}/decision`, { method: "POST", body: { decision, note: note || undefined } });
      toast("ok", { under_review: "Marked as under review.", needs_info: "Question sent to the applicant.", approved: `${a.name} is now an instructor. They keep their student access.`, rejected: "Application rejected. They stay a student." }[decision]);
      setNotes((n) => ({ ...n, [a.userId]: "" }));
      reload();
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); }
  }

  return (
    <>
      <PageHead title="Instructor applications" sub="Students apply to teach; you approve, reject or ask for more information. Approval adds the Instructor role and keeps student access." />
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line">
        <div role="tablist" className="flex max-w-full gap-1 overflow-x-auto">
          {TABS.map(([k, l]) => (
            <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => { setTab(k); setPage(1); setOpenId(null); }}
              className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-bold sm:px-4 ${tab === k ? "border-violet text-ink" : "border-transparent text-muted hover:text-ink"}`}>
              {l}{k === "open" && openCount ? <span className="ml-1.5 rounded-full bg-amber px-1.5 text-xs text-[var(--on-amber)]">{openCount}</span> : null}
            </button>
          ))}
        </div>
        <input type="search" aria-label="Search applications" className="field mb-2 !w-64 max-w-full" placeholder="Search name, email, headline" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      </div>
      {error ? <p className="mt-4 text-rose">{error}</p> : null}
      {!data && !error ? <Skeleton className="mt-6 h-72" /> : null}
      {data ? (
        <>
          <ul className="mt-5 space-y-3">
            {data.items.map((a) => {
              const open = openId === a.userId;
              return (
                <li key={a.userId} className="rounded-tile border border-line bg-surface" data-testid="application">
                  <button type="button" onClick={() => setOpenId(open ? null : a.userId)} aria-expanded={open} className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3.5 text-left">
                    <Avatar name={a.name} size={36} />
                    <span className="min-w-0">
                      <span className="flex min-w-0 items-center gap-2"><span className="truncate font-bold">{a.name} <span className="font-normal text-muted">· {a.email}</span></span>{a.official ? <OfficialBadge short className="shrink-0" /> : null}</span>
                      <span className="block truncate text-sm text-ink-2">{a.headline || "No headline"}{a.expertise.length ? ` · ${a.expertise.slice(0, 4).join(", ")}` : ""}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="hidden text-xs text-muted sm:inline">Applied {date(a.appliedAt)}</span>
                      <StatusBadge status={a.status === "pending" ? "new" : a.status} />
                      <ChevronDown className={`size-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                    </span>
                  </button>
                  {open ? (
                    <div className="grid gap-6 border-t border-line px-4 py-5 lg:grid-cols-[1.4fr_1fr]">
                      <dl className="space-y-4 text-sm">
                        <div><dt className="font-bold text-ink">Areas of expertise</dt><dd className="mt-1 flex flex-wrap gap-1.5">{a.expertise.length ? a.expertise.map((x) => <span key={x} className="chip">{x}</span>) : <span className="text-muted">Not given (older application)</span>}</dd></div>
                        <div><dt className="font-bold text-ink">Professional background</dt><dd className="mt-1 whitespace-pre-line text-ink-2">{a.bio || "—"}</dd></div>
                        <div><dt className="font-bold text-ink">Teaching experience</dt><dd className="mt-1 whitespace-pre-line text-ink-2">{a.experience || "—"}</dd></div>
                        <div><dt className="font-bold text-ink">Courses they plan</dt><dd className="mt-1 whitespace-pre-line text-ink-2">{a.plannedCourses || "—"}</dd></div>
                        {a.extraInfo ? <div><dt className="font-bold text-ink">Additional information</dt><dd className="mt-1 whitespace-pre-line text-ink-2">{a.extraInfo}</dd></div> : null}
                        {a.website ? <div><dt className="font-bold text-ink">Portfolio</dt><dd className="mt-1"><a href={a.website} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1">{a.website}<ExternalLink className="size-3.5" /></a></dd></div> : null}
                        <p className="text-xs text-muted">Member since {date(a.memberSince)} · applied {date(a.appliedAt)}{a.reviewedBy ? ` · last reviewed by ${a.reviewedBy.name} ${date(a.reviewedAt)}` : ""}</p>
                      </dl>
                      <div className="space-y-3">
                        {a.reviewNote ? <p className="rounded-tile bg-surface-2 px-3 py-2 text-sm text-ink-2"><b className="text-ink">Last note:</b> {a.reviewNote}</p> : null}
                        {reviewer && a.status !== "approved" ? (
                          <>
                            <label className="label" htmlFor={`note-${a.userId}`}>Note for the applicant</label>
                            <textarea id={`note-${a.userId}`} className="field" rows={3} maxLength={4000} value={notes[a.userId] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [a.userId]: e.target.value }))} placeholder="Required to ask a question or reject. They receive it by email." />
                            <div className="flex flex-wrap gap-2">
                              <button type="button" className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => decide(a, "approved")} data-testid="approve-instructor">{busy === a.userId + "approved" ? <Loader2 className="size-4 animate-spin" /> : null}Approve</button>
                              <button type="button" className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => decide(a, "needs_info")} data-testid="ask-info">Ask for information</button>
                              {a.status === "pending" ? <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => decide(a, "under_review")}>Mark under review</button> : null}
                              {a.status !== "rejected" ? <button type="button" className="btn btn-ghost btn-sm text-rose" disabled={!!busy} onClick={() => decide(a, "rejected")} data-testid="reject-instructor">Reject</button> : null}
                            </div>
                          </>
                        ) : null}
                        {a.status === "approved" ? (
                          <div className="space-y-2 text-sm text-ink-2">
                            <p>{a.courses} course{a.courses === 1 ? "" : "s"} · payouts {a.payoutsEnabled ? "enabled" : "not set up"} · share {a.commissionBps != null ? `${(10000 - a.commissionBps) / 100}% (agreed)` : `${defaultShare}% (default)`}{a.payToPlatform ? ", paid to DEL" : ""}{a.official ? ". Courses shown under the DevOps Easy Learning brand" : ""}</p>
                            {superAdmin ? <button type="button" className="btn btn-outline btn-sm" onClick={() => setTerms({ userId: a.userId, name: a.name, email: a.email, status: "approved", commissionBps: a.commissionBps, payToPlatform: a.payToPlatform, official: a.official } as AdminInstructor)} data-testid="edit-terms">Edit type and payment terms</button> : null}
                            {reviewer ? <button type="button" className="btn btn-ghost btn-sm ml-1 text-rose" disabled={!!busy} onClick={() => decide(a, "rejected")}>Remove instructor access</button> : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
            {!data.items.length ? <li className="rounded-tile border border-line bg-surface px-4 py-10 text-center text-ink-2">{tab === "open" ? "No applications waiting." : "Nothing here yet."}</li> : null}
          </ul>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} noun="applications" />
        </>
      ) : null}
      <TermsDialog key={terms?.userId ?? "none"} i={terms} defaultSharePercent={defaultShare} onClose={() => setTerms(null)} onSaved={() => { setTerms(null); reload(); }} />
    </>
  );
}
