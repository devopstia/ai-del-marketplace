"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Archive, ArchiveRestore, ExternalLink, FileText, ListChecks, Loader2, Lock, PlayCircle, Save, Star, Trash2, Upload } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { list, obj, toStudioCourse } from "@/lib/normalize";
import { clock, date, dateTime, money, levelLabel } from "@/lib/format";
import { toCourseState } from "@/lib/admin-courses";
import { PageHead } from "@/components/shell/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { CourseCover } from "@/components/CourseCover";
import { Skeleton } from "@/components/Empty";
import { AdminDecision } from "@/components/AdminDecision";
import { VideoPlayer } from "@/components/VideoPlayer";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { ShareBannerEditor } from "@/components/social/ShareBannerEditor";

const toDetail = (x: unknown) => ({
  ...toStudioCourse(x),
  coverTemplateId: (obj(x).coverTemplateId as string | null) ?? null,
  history: list(x, "history").map((h) => { const o = obj(h); return { id: String(o.id), action: String(o.action), at: String(o.at), meta: obj(o.meta) }; }),
});
const ACTION: Record<string, string> = {
  "course.approve": "Approved", "course.reject": "Rejected", "course.request_changes": "Changes requested", "course.unpublish": "Unpublished", "course.published_by_admin": "Published by DEL",
  "course.admin_edited": "Edited by DEL", "course.featured": "Featured", "course.unfeatured": "No longer featured", "course.archived": "Archived", "course.restored": "Restored",
  "course.deletion_requested": "Deletion scheduled", "course.deletion_cancelled": "Deletion cancelled", "course.purged": "Content deleted", "course.price_changed": "Price changed",
};
const LEVELS = ["beginner", "intermediate", "advanced"] as const;
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

/**
 * Super Admin › Courses › a course (owner 2026-11-26, docs/SUPER_ADMIN.md): preview, edit, publish, feature, archive and the
 * 30-day deletion, for any instructor's course. The instructor always stays the owner.
 */
export default function AdminCourse() {
  const { id } = useParams<{ id: string }>();
  const { me } = useAuth();
  const toast = useToast();
  const superAdmin = !!me?.roles.includes("super_admin");
  const detail = useApi(`/admin/courses/${id}`, toDetail);
  const state = useApi(`/admin/courses/${id}/state`, toCourseState);
  const cats = useApi(superAdmin ? "/admin/categories" : null, (r) => list(r, "items").map((c) => ({ id: String(obj(c).id), name: String(obj(c).name) })));
  const templates = useApi(superAdmin ? "/admin/cover-templates" : null, (r) => list(r, "items").map((t) => ({ id: String(obj(t).id), name: String(obj(t).name), active: obj(t).active !== false })));
  const c = detail.data;
  const s = state.data;
  const [busy, setBusy] = useState<string | null>(null);
  const [video, setVideo] = useState<{ id: string; url: string } | null>(null);
  const [form, setForm] = useState({ title: "", subtitle: "", description: "", objectives: "", requirements: "", categoryId: "", level: "beginner", language: "en", price: "0", coverTemplateId: "", reason: "" });
  const [archiveReason, setArchiveReason] = useState("");
  const [del, setDel] = useState({ reason: "", title: "", code: "" });
  const [publishNote, setPublishNote] = useState("");

  useEffect(() => {
    if (!c) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start the editor from the saved course
    setForm({ title: c.title, subtitle: c.subtitle, description: c.description, objectives: c.objectives.join("\n"), requirements: c.requirements.join("\n"), categoryId: c.categoryId ?? "", level: c.level, language: c.language, price: (c.priceCents / 100).toFixed(2), coverTemplateId: c.coverTemplateId ?? "", reason: "" });
  }, [c]);

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    try { await fn(); toast("ok", ok); detail.reload(); state.reload(); return true; }
    catch (e) { toast("error", errMsg(e)); return false; } finally { setBusy(null); }
  }
  const post = (path: string, body?: unknown) => api(`/admin/courses/${id}/${path}`, { method: "POST", body });
  async function play(lectureId: string, assetId: string) {
    setBusy(`play:${lectureId}`);
    try { const r = obj(await api(`/admin/videos/${assetId}/playback`, { method: "POST" })); setVideo({ id: lectureId, url: String(r.url) }); }
    catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); }
  }
  async function save() {
    if (!c) return;
    const body = {
      title: form.title.trim(), subtitle: form.subtitle.trim(), description: form.description, objectives: lines(form.objectives), requirements: lines(form.requirements),
      categoryId: form.categoryId || null, level: form.level, language: form.language.trim() || "en", priceCents: Math.round(Number(form.price || 0) * 100),
      coverTemplateId: form.coverTemplateId || null, reason: form.reason.trim() || undefined,
    };
    if (!Number.isFinite(body.priceCents) || body.priceCents < 0) return toast("error", "Enter a price of 0 or more.");
    await run("save", () => api(`/admin/courses/${id}`, { method: "PATCH", body }), "Course saved. The changes are live and in the course history.");
  }

  const spin = (k: string) => (busy === k ? <Loader2 className="size-4 animate-spin" /> : null);
  const archived = s?.lifecycle === "archived" || s?.lifecycle === "deleting";
  const purged = s?.lifecycle === "purged";

  return (
    <div className="max-w-6xl">
      <PageHead title={c?.title ?? "Course"} sub={c ? `By ${c.instructor?.name ?? "an instructor"} (the owner). ${superAdmin ? "Changes you make here are recorded in the course history under your name." : ""}` : ""}
        actions={<span className="flex flex-wrap gap-2">{c?.status === "published" && c.slug ? <Link href={`/courses/${c.slug}`} className="btn btn-outline btn-sm" target="_blank"><ExternalLink className="size-4" />Public page</Link> : null}<Link href="/admin/courses" className="btn btn-ghost btn-sm">All courses</Link></span>} />
      {detail.error ? <p className="text-rose">{detail.error}</p> : null}
      {!c || !s ? (!detail.error ? <Skeleton className="h-96" /> : null) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-6">
            <section className="rounded-panel border border-line bg-surface">
              <div className="grid gap-5 p-5 sm:grid-cols-[200px_minmax(0,1fr)]">
                <CourseCover slug={c.slug || c.id} title={c.title} category={c.category?.name} thumbnailUrl={c.thumbnailUrl} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><StatusBadge status={c.status} />{s.lifecycle !== "active" ? <StatusBadge status={s.lifecycle} /> : null}{s.featured ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-soft px-2 py-0.5 text-xs font-bold text-amber"><Star className="size-3" />Featured</span> : null}</div>
                  <p className="mt-2 text-ink-2">{c.subtitle}</p>
                  <p className="mt-2 flex flex-wrap gap-x-4 text-sm text-muted"><span>{c.category?.name ?? "No category"}</span><span>{levelLabel[c.level]}</span><span>{money(c.priceCents, c.currency)}</span><span>{c.sections.reduce((n, x) => n + x.lectures.length, 0)} lessons</span></p>
                </div>
              </div>
              {s.lifecycle !== "active" ? (
                <p className="border-t border-line bg-surface-2/50 px-5 py-3 text-sm text-ink" data-testid="lifecycle-note">
                  {s.lifecycle === "archived" ? <>Archived on {date(s.archivedAt!)}{s.archiveReason ? ` (“${s.archiveReason}”)` : ""}. Not listed and not for sale; enrolled learners keep their access until it ends.</> : null}
                  {s.lifecycle === "deleting" ? <>Deletion scheduled: content is removed on <b>{date(s.deleteAfter!)}</b> ({s.daysLeft} day{s.daysLeft === 1 ? "" : "s"} left){s.learners.paidAccessRunning ? <>, or later when the last paid year of access ends ({s.learners.lastPaidAccessEnds ? date(s.learners.lastPaidAccessEnds) : "—"}; {s.learners.paidAccessRunning} learner{s.learners.paidAccessRunning === 1 ? "" : "s"})</> : null}. Restore it any time before.</> : null}
                  {s.lifecycle === "purged" ? <>Content deleted on {date(s.purgedAt!)}. Orders, refunds, certificates and this history are kept.</> : null}
                </p>
              ) : null}
            </section>

            {video ? <div className="rounded-panel bg-stage p-3"><VideoPlayer src={video.url} autoPlay title="Preview" /></div> : null}
            <section className="rounded-panel border border-line bg-surface p-5" aria-labelledby="curr-h">
              <h2 id="curr-h" className="font-display text-lg font-bold">Preview the content</h2>
              {c.sections.length ? (
                <ol className="mt-3 space-y-3 text-sm">
                  {c.sections.map((sec) => (
                    <li key={sec.id}>
                      <p className="font-bold">{sec.title}</p>
                      <ul className="mt-1 divide-y divide-line rounded-lg border border-line">
                        {sec.lectures.map((l) => {
                          const I = l.type === "article" ? FileText : l.type === "quiz" ? ListChecks : PlayCircle;
                          return (
                            <li key={l.id} className={`flex items-center gap-2 px-3 py-2 ${video?.id === l.id ? "bg-violet-soft" : ""}`}>
                              <I className="size-4 shrink-0 text-muted" aria-hidden="true" /><span className="min-w-0 flex-1">{l.title}</span>
                              {l.isPreview ? <span className="chip !py-0 text-xs">Preview</span> : null}
                              <span className="tabular-nums text-muted">{l.durationSec ? clock(l.durationSec) : ""}</span>
                              {l.type === "video" && l.videoAssetId ? <button type="button" className="link text-xs" onClick={() => void play(l.id, l.videoAssetId!)}>{busy === `play:${l.id}` ? <Loader2 className="size-3.5 animate-spin" /> : "Watch"}</button> : null}
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))}
                </ol>
              ) : <p className="mt-2 text-sm text-ink-2">{purged ? "The content of this course was deleted." : "No lessons yet."}</p>}
            </section>

            {superAdmin && !purged ? (
              <section className="rounded-panel border border-line bg-surface p-5" aria-labelledby="edit-h" data-testid="course-edit">
                <h2 id="edit-h" className="font-display text-lg font-bold">Edit course information</h2>
                <p className="mt-1 text-sm text-ink-2">Changes go live at once (no review). The instructor stays the owner; lessons and videos are edited in the instructor’s studio.</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="min-w-0 sm:col-span-2"><label className="label" htmlFor="c-title">Title</label><input id="c-title" className="field" maxLength={160} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                  <div className="min-w-0 sm:col-span-2"><label className="label" htmlFor="c-sub">Subtitle</label><input id="c-sub" className="field" maxLength={300} value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></div>
                  <div className="min-w-0 sm:col-span-2"><label className="label" htmlFor="c-desc">Description</label><textarea id="c-desc" className="field min-h-36" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                  <div className="min-w-0"><label className="label" htmlFor="c-obj">What learners will learn (one per line)</label><textarea id="c-obj" className="field min-h-28" value={form.objectives} onChange={(e) => setForm({ ...form, objectives: e.target.value })} /></div>
                  <div className="min-w-0"><label className="label" htmlFor="c-req">Requirements (one per line)</label><textarea id="c-req" className="field min-h-28" value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} /></div>
                  <div className="min-w-0"><label className="label" htmlFor="c-cat">Category</label><select id="c-cat" className="field" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}><option value="">No category</option>{(cats.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
                  <div className="min-w-0"><label className="label" htmlFor="c-level">Level</label><select id="c-level" className="field" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>{LEVELS.map((l) => <option key={l} value={l}>{levelLabel[l]}</option>)}</select></div>
                  <div className="min-w-0"><label className="label" htmlFor="c-price">Price (USD, 0 = free)</label><input id="c-price" className="field tabular-nums" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value.replace(/[^\d.]/g, "") })} /></div>
                  <div className="min-w-0"><label className="label" htmlFor="c-cover">Cover template</label><select id="c-cover" className="field" value={form.coverTemplateId} onChange={(e) => setForm({ ...form, coverTemplateId: e.target.value })}><option value="">Chosen automatically</option>{(templates.data ?? []).filter((t) => t.active || t.id === form.coverTemplateId).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                  <div className="min-w-0"><label className="label" htmlFor="c-lang">Language code</label><input id="c-lang" className="field" maxLength={10} value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} /></div>
                  <div className="min-w-0"><label className="label" htmlFor="c-reason">Reason (optional, for the history)</label><input id="c-reason" className="field" maxLength={500} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
                </div>
                <div className="mt-4 flex justify-end"><button type="button" className="btn btn-primary" disabled={!!busy || form.title.trim().length < 3} onClick={() => void save()} data-testid="save-course">{spin("save") ?? <Save className="size-4" />}Save changes</button></div>
              </section>
            ) : null}
            {superAdmin && !purged && c ? <ShareBannerEditor base={`/admin/courses/${c.id}`} title={c.title} /> : null}
          </div>

          <aside className="space-y-4">
            {superAdmin && !purged ? (
              <section className="rounded-panel border border-line bg-surface p-5" aria-labelledby="act-h" data-testid="course-actions">
                <h2 id="act-h" className="font-display text-lg font-bold">Publishing</h2>
                {archived ? (
                  <div className="mt-3 space-y-2">
                    <button type="button" className="btn btn-primary w-full" disabled={!!busy} onClick={() => void run("restore", () => post("restore"), "Course restored to the status it had before.")} data-testid="restore-course">{spin("restore") ?? <ArchiveRestore className="size-4" />}Restore</button>
                    {s.lifecycle === "deleting" ? <button type="button" className="btn btn-outline w-full" disabled={!!busy} onClick={() => void run("cancel", () => post("cancel-deletion"), "Deletion cancelled. The course stays archived.")} data-testid="cancel-deletion">{spin("cancel")}Cancel deletion, keep archived</button> : null}
                  </div>
                ) : c.status === "published" ? (
                  <div className="mt-3 space-y-3">
                    <button type="button" className="btn btn-outline w-full" disabled={!!busy} onClick={() => void run("feature", () => post("feature", { on: !s.featured }), s.featured ? "No longer featured." : "Featured: it now leads the popular courses on the homepage and catalogue.")} data-testid="feature-course">{spin("feature") ?? <Star className="size-4" />}{s.featured ? "Stop featuring" : "Feature this course"}</button>
                    <details className="rounded-tile border border-line p-3"><summary className="cursor-pointer text-sm font-bold">Unpublish</summary><div className="mt-2"><p className="mb-2 text-xs text-ink-2">Enrolled learners keep access. It can’t be bought until it’s published again.</p><AdminDecision courseId={c.id} actions={["unpublish"]} onDone={() => { detail.reload(); state.reload(); }} /></div></details>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <label className="label" htmlFor="pub-note">Note to the instructor (optional)</label>
                    <input id="pub-note" className="field" maxLength={500} value={publishNote} onChange={(e) => setPublishNote(e.target.value)} />
                    <button type="button" className="btn btn-primary w-full" disabled={!!busy} onClick={() => void run("publish", () => post("publish", { note: publishNote.trim() || undefined }), "Published. It is listed and for sale now.")} data-testid="publish-course">{spin("publish") ?? <Upload className="size-4" />}Publish now</button>
                    <p className="text-xs text-muted">Publishes without the review queue. Needs at least one lesson.</p>
                  </div>
                )}
              </section>
            ) : null}

            {superAdmin && !archived && !purged ? (
              <section className="rounded-panel border border-line bg-surface p-5" aria-labelledby="arch-h">
                <h2 id="arch-h" className="flex items-center gap-2 font-display text-lg font-bold"><Archive className="size-5 text-muted" aria-hidden="true" />Archive</h2>
                <p className="mt-1 text-sm text-ink-2">Takes it off the marketplace and keeps it for later. Never deleted automatically. {s.learners.paidAccessRunning + s.learners.accessWithoutEndDate} enrolled learner{s.learners.paidAccessRunning + s.learners.accessWithoutEndDate === 1 ? "" : "s"} keep their access until it ends.</p>
                <label className="label mt-3" htmlFor="arch-reason">Reason</label>
                <input id="arch-reason" className="field" maxLength={500} value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)} />
                <button type="button" className="btn btn-outline mt-3 w-full" disabled={!!busy || archiveReason.trim().length < 3} onClick={() => void run("archive", () => post("archive", { reason: archiveReason.trim() }), "Archived.").then((ok) => ok && setArchiveReason(""))} data-testid="archive-course">{spin("archive")}Archive course</button>
              </section>
            ) : null}

            {superAdmin && s.lifecycle !== "deleting" && !purged ? (
              <section className="rounded-panel border border-rose/40 bg-surface p-5" aria-labelledby="del-h" data-testid="delete-course-box">
                <h2 id="del-h" className="flex items-center gap-2 font-display text-lg font-bold text-rose"><Trash2 className="size-5" aria-hidden="true" />Delete</h2>
                <p className="mt-1 text-sm text-ink-2">The course is archived now and its videos, files and lessons are deleted after {s.retentionDays} days. You can restore it until then.</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-ink-2">
                  <li>{s.learners.paidAccessRunning ? <>{s.learners.paidAccessRunning} learner{s.learners.paidAccessRunning === 1 ? " has" : "s have"} paid access until as late as {s.learners.lastPaidAccessEnds ? date(s.learners.lastPaidAccessEnds) : "—"}: the deletion waits for that date.</> : "No paid access is still running."}</li>
                  {s.learners.accessWithoutEndDate ? <li>{s.learners.accessWithoutEndDate} learner{s.learners.accessWithoutEndDate === 1 ? "" : "s"} with free or granted access lose it when the content is deleted.</li> : null}
                  <li>Orders, refunds, certificates and reviews are kept.</li>
                </ul>
                <label className="label mt-3" htmlFor="del-reason">Reason</label>
                <input id="del-reason" className="field" maxLength={500} value={del.reason} onChange={(e) => setDel({ ...del, reason: e.target.value })} />
                <label className="label mt-2" htmlFor="del-title">Type the course title to confirm</label>
                <input id="del-title" className="field" value={del.title} onChange={(e) => setDel({ ...del, title: e.target.value })} placeholder={c.title} autoComplete="off" />
                <label className="label mt-2" htmlFor="del-code"><Lock className="mr-1 inline size-3.5" />Your authenticator code</label>
                <input id="del-code" className="field tabular-nums" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={del.code} onChange={(e) => setDel({ ...del, code: e.target.value.replace(/\D/g, "") })} placeholder="6 digits" />
                <button type="button" className="btn btn-danger mt-3 w-full" disabled={!!busy || del.reason.trim().length < 3 || del.title.trim() !== c.title.trim()} onClick={() => void run("delete", () => post("delete", { reason: del.reason.trim(), confirmTitle: del.title, code: del.code || undefined }), `Deletion scheduled in ${s.retentionDays} days. The course is archived.`).then((ok) => ok && setDel({ reason: "", title: "", code: "" }))} data-testid="delete-course">{spin("delete")}Schedule deletion</button>
              </section>
            ) : null}

            <section className="rounded-panel border border-line bg-surface p-5" aria-labelledby="hist-h">
              <h2 id="hist-h" className="font-display text-lg font-bold">History</h2>
              {c.history.length ? (
                <ol className="mt-2 divide-y divide-line text-sm" data-testid="course-history">
                  {c.history.map((h) => (
                    <li key={h.id} className="py-2"><span className="block text-xs text-muted">{dateTime(h.at)}</span><b className="text-ink">{ACTION[h.action] ?? h.action}</b>{h.meta.reason ? <span className="text-ink-2"> · “{String(h.meta.reason)}”</span> : h.meta.note ? <span className="text-ink-2"> · “{String(h.meta.note)}”</span> : null}</li>
                  ))}
                </ol>
              ) : <p className="mt-2 text-sm text-muted">Nothing recorded yet.</p>}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
