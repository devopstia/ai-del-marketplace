"use client";
import Link from "next/link";
import { useState } from "react";
import { Loader2, Plus, Tag } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { moneyExact } from "@/lib/format";
import { DataTable, PageHead } from "@/components/shell/AppShell";
import { Skeleton } from "@/components/Empty";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";
import { SaleEnds } from "@/components/SaleEnds";
import { fmtWhen, fromLocalInput, inDays, statusClass, statusLabel, toLocalInput } from "@/components/promotions/when";

type Scope = "all" | "categories" | "courses";
interface Promo { id: string; name: string; percentOff: number; startsAt: string; endsAt: string; scope: Scope; categoryIds: string[]; courseIds: string[]; status: string; courseCount: number }
interface Sale { id: string; status: string; salePriceCents: number; listPriceCents: number; percentOff: number; startsAt: string; endsAt: string; course: { id: string; title: string; slug: string }; instructor: { id: string; name: string } }
interface Opt { id: string; name: string }

const arr = (x: unknown) => (Array.isArray(x) ? x : []);
const toPromos = (r: unknown) => {
  const o = obj(r);
  const rules = obj(o.rules);
  return {
    rules: { minPercent: Number(rules.minPercent ?? 5), maxPercent: Number(rules.maxPercent ?? 90), maxDays: Number(rules.maxDays ?? 90) },
    items: arr(o.items).map((p): Promo => {
      const x = obj(p);
      return { id: String(x.id), name: String(x.name), percentOff: Number(x.percentOff), startsAt: String(x.startsAt), endsAt: String(x.endsAt), scope: (x.scope as Scope) ?? "all", categoryIds: arr(x.categoryIds).map(String), courseIds: arr(x.courseIds).map(String), status: String(x.status), courseCount: Number(x.courseCount ?? 0) };
    }),
  };
};
const toSales = (r: unknown) => arr(obj(r).items).map((s): Sale => {
  const x = obj(s);
  const c = obj(x.course);
  const i = obj(x.instructor);
  return { id: String(x.id), status: String(x.status), salePriceCents: Number(x.salePriceCents), listPriceCents: Number(x.listPriceCents), percentOff: Number(x.percentOff), startsAt: String(x.startsAt), endsAt: String(x.endsAt), course: { id: String(c.id), title: String(c.title), slug: String(c.slug) }, instructor: { id: String(i.id), name: String(i.name) } };
});
const toOpts = (key: string, label: string) => (r: unknown): Opt[] => arr(obj(r)[key] ?? r).map((x) => ({ id: String(obj(x).id), name: String(obj(x)[label]) }));
const toCats = toOpts("items", "name");
const toCourses = toOpts("items", "title");

function PromoForm({ edit, rules, onDone, onClose }: { edit?: Promo; rules: { minPercent: number; maxPercent: number; maxDays: number }; onDone: () => void; onClose: () => void }) {
  const toast = useToast();
  const { data: cats } = useApi("/categories", toCats);
  const { data: courses } = useApi("/courses?pageSize=48&sort=newest", toCourses);
  const running = edit?.status === "active";
  const [now] = useState(() => Date.now());
  const [name, setName] = useState(edit?.name ?? "");
  const [pct, setPct] = useState(String(edit?.percentOff ?? 30));
  const [startNow, setStartNow] = useState(!edit);
  const [start, setStart] = useState(() => toLocalInput(edit?.startsAt ?? inDays(1, new Date(now))));
  const [end, setEnd] = useState(() => toLocalInput(edit?.endsAt ?? inDays(7, new Date(now))));
  const [scope, setScope] = useState<Scope>(edit?.scope ?? "all");
  const [catIds, setCatIds] = useState<string[]>(edit?.categoryIds ?? []);
  const [courseIds, setCourseIds] = useState<string[]>(edit?.courseIds ?? []);
  const [busy, setBusy] = useState(false);

  const p = Number(pct);
  const startIso = running ? edit!.startsAt : startNow ? new Date(now).toISOString() : fromLocalInput(start);
  const endIso = fromLocalInput(end);
  const days = startIso && endIso ? (new Date(endIso).getTime() - new Date(startIso).getTime()) / 86400_000 : 0;
  const problem =
    name.trim().length < 3 ? "Give the promotion a name (3 characters or more)."
      : !Number.isInteger(p) || p < rules.minPercent || p > rules.maxPercent ? `Discount must be a whole number from ${rules.minPercent}% to ${rules.maxPercent}%.`
        : !startIso || !endIso || days <= 0 ? "The end must be after the start."
          : days > rules.maxDays + 1 / 1440 ? `A promotion can last up to ${rules.maxDays} days.`
            : new Date(endIso).getTime() <= now ? "The end must be in the future."
              : scope === "categories" && !catIds.length ? "Pick at least one topic."
                : scope === "courses" && !courseIds.length ? "Pick at least one course." : null;
  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (problem) return;
    setBusy(true);
    try {
      const body = { name: name.trim(), percentOff: p, startsAt: running ? edit!.startsAt : startNow ? new Date().toISOString() : startIso, endsAt: endIso, scope, categoryIds: catIds, courseIds };
      if (edit) await api(`/admin/promotions/${edit.id}`, { method: "PATCH", body });
      else await api("/admin/promotions", { method: "POST", body });
      toast("ok", edit ? "Promotion updated." : startNow ? "Promotion is live." : "Promotion scheduled.");
      onDone();
    } catch (err) { toast("error", errMsg(err)); } finally { setBusy(false); }
  }

  const pick = (opts: Opt[] | null, list: string[], set: (v: string[]) => void) => (
    <div className="mt-2 grid max-h-56 gap-1 overflow-y-auto rounded-lg border border-line bg-surface p-2 sm:grid-cols-2">
      {!opts ? <Skeleton className="h-8" /> : opts.map((o) => (
        <label key={o.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-surface-2">
          <input type="checkbox" className="size-4 accent-[var(--violet)]" checked={list.includes(o.id)} onChange={() => toggle(list, set, o.id)} />
          <span className="min-w-0 truncate">{o.name}</span>
        </label>
      ))}
    </div>
  );

  return (
    <form onSubmit={save} className="mb-8 rounded-panel border border-line bg-surface p-5 sm:p-6" data-testid="promo-form">
      <h2 className="font-display text-xl font-bold">{edit ? "Edit promotion" : "New marketplace promotion"}</h2>
      <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
        <div>
          <label className="label" htmlFor="pr-name">Name learners see</label>
          <input id="pr-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Spring sale" maxLength={80} />
        </div>
        <div>
          <label className="label" htmlFor="pr-pct">Discount</label>
          <div className="flex items-center gap-2"><input id="pr-pct" inputMode="numeric" className="field tabular-nums" value={pct} onChange={(e) => setPct(e.target.value)} /><span className="font-bold">% off</span></div>
        </div>
        <div>
          <span className="label">Starts</span>
          {running ? <p className="py-2 text-sm text-ink-2">Already running since {fmtWhen(edit!.startsAt)}</p> : (
            <>
              <label className="flex items-center gap-2 text-sm text-ink-2"><input type="checkbox" checked={startNow} onChange={(e) => setStartNow(e.target.checked)} className="size-4 accent-[var(--violet)]" />Start now</label>
              {!startNow ? <input type="datetime-local" aria-label="Start date and time" className="field mt-2" value={start} onChange={(e) => setStart(e.target.value)} /> : null}
            </>
          )}
        </div>
        <div>
          <label className="label" htmlFor="pr-end">Ends</label>
          <input id="pr-end" type="datetime-local" className="field" value={end} onChange={(e) => setEnd(e.target.value)} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[3, 7, 14, 30].map((d) => <button key={d} type="button" onClick={() => setEnd(toLocalInput(inDays(d, new Date(startIso ?? now))))} className="rounded-full border border-line px-2.5 py-0.5 text-xs font-bold text-ink-2 hover:border-violet hover:text-violet">{d} days</button>)}
          </div>
        </div>
      </div>
      <fieldset className="mt-5">
        <legend className="label">Which courses</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {([["all", "Every paid course"], ["categories", "Chosen topics"], ["courses", "Chosen courses"]] as const).map(([v, l]) => (
            <label key={v} className="flex items-center gap-2 text-sm"><input type="radio" name="scope" className="size-4 accent-[var(--violet)]" checked={scope === v} onChange={() => setScope(v)} />{l}</label>
          ))}
        </div>
        {scope === "categories" ? pick(cats, catIds, setCatIds) : null}
        {scope === "courses" ? pick(courses, courseIds, setCourseIds) : null}
        <p className="hint">Instructors who opted a course out are skipped; DevOps Easy Learning courses are always included. Free courses never change. If a course also has its own sale, learners get the lower price.</p>
      </fieldset>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        {problem ? <p className="text-sm font-bold text-rose" role="alert">{problem}</p> : <p className="text-sm text-ink-2">A {moneyExact(4999)} course would sell for {moneyExact(Math.max(499, Math.round((4999 * (100 - p)) / 100)))}. Instructors earn their usual share of what learners pay.</p>}
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
          <button className="btn btn-primary btn-sm" disabled={busy || !!problem} data-testid="save-promo">{busy ? <Loader2 className="size-4 animate-spin" /> : null}{edit ? "Save changes" : startNow ? "Start promotion" : "Schedule promotion"}</button>
        </div>
      </div>
    </form>
  );
}

export default function AdminPromotions() {
  const toast = useToast();
  const { me } = useAuth();
  const canEdit = !!me?.roles.includes("super_admin");
  const promos = useApi("/admin/promotions", toPromos);
  const [salesStatus, setSalesStatus] = useState<"open" | "all">("open");
  const sales = useApi(`/admin/course-sales?status=${salesStatus}`, toSales);
  const [form, setForm] = useState<null | "new" | Promo>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function cancelPromo(id: string) {
    setBusy(true);
    try { await api(`/admin/promotions/${id}/cancel`, { method: "POST" }); toast("ok", "Promotion cancelled. Regular prices apply again."); setConfirm(null); promos.reload(); }
    catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
  }
  async function cancelSale(id: string) {
    setBusy(true);
    try { await api(`/admin/course-sales/${id}/cancel`, { method: "POST", body: { note } }); toast("ok", "Sale cancelled. The note is in the audit log."); setConfirm(null); setNote(""); sales.reload(); }
    catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
  }
  const scopeText = (p: Promo) => p.scope === "all" ? "Every paid course" : p.scope === "categories" ? `${p.categoryIds.length} ${p.categoryIds.length === 1 ? "topic" : "topics"}` : `${p.courseIds.length} chosen ${p.courseIds.length === 1 ? "course" : "courses"}`;

  return (
    <>
      <PageHead
        title="Promotions"
        sub="Marketplace-wide sales and every instructor’s own sales. Prices change only while a sale runs and return by themselves when it ends."
        actions={canEdit && !form ? <button type="button" className="btn btn-primary" onClick={() => setForm("new")} data-testid="new-promo"><Plus className="size-4" />New promotion</button> : null}
      />
      {!canEdit ? <p className="mb-6 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">Only a super admin can create, change or cancel promotions and sales.</p> : null}
      {form && promos.data ? <PromoForm edit={form === "new" ? undefined : form} rules={promos.data.rules} onDone={() => { setForm(null); promos.reload(); }} onClose={() => setForm(null)} /> : null}

      <h2 className="mb-3 font-display text-lg font-bold">Marketplace promotions</h2>
      {!promos.data ? <Skeleton className="h-40" /> : (
        <DataTable head={["Status", "Promotion", "Period", "Courses", ""]} min={760}
          empty={!promos.data.items.length ? <p className="p-6 text-center text-sm text-muted">No promotions yet.{canEdit ? " Use “New promotion” to run a sale across the marketplace." : ""}</p> : null}>
          {promos.data.items.map((p) => {
            const open = p.status === "active" || p.status === "scheduled";
            return (
              <tr key={p.id}>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusClass[p.status]}`}>{statusLabel[p.status]}</span></td>
                <td className="px-4 py-3"><b>{p.name}</b><span className="block text-muted">{p.percentOff}% off</span></td>
                <td className="px-4 py-3 text-ink-2">{fmtWhen(p.startsAt)} to {fmtWhen(p.endsAt)}{p.status === "active" ? <span className="block text-xs font-bold text-rose"><SaleEnds endsAt={p.endsAt} /></span> : null}</td>
                <td className="px-4 py-3 text-ink-2">{scopeText(p)}<span className="block text-xs text-muted">{p.courseCount} live {p.courseCount === 1 ? "course" : "courses"} in scope</span></td>
                <td className="px-4 py-3 text-right">
                  {canEdit && open ? (
                    <span className="inline-flex gap-2">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm(p)} disabled={busy}>Edit</button>
                      {confirm === p.id ? (
                        <button type="button" className="btn btn-sm bg-rose text-white" onClick={() => cancelPromo(p.id)} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : null}Yes, cancel</button>
                      ) : <button type="button" className="btn btn-ghost btn-sm text-rose" onClick={() => setConfirm(p.id)} disabled={busy}>Cancel</button>}
                    </span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}

      <div className="mb-3 mt-10 flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Instructor sales</h2>
        <div className="flex gap-1 rounded-full border border-line bg-surface p-1 text-xs font-bold" role="group" aria-label="Which sales">
          {(["open", "all"] as const).map((s) => <button key={s} type="button" aria-pressed={salesStatus === s} onClick={() => setSalesStatus(s)} className={`rounded-full px-3 py-1 ${salesStatus === s ? "bg-violet text-white" : "text-ink-2"}`}>{s === "open" ? "Running and scheduled" : "All"}</button>)}
        </div>
      </div>
      {!sales.data ? <Skeleton className="h-40" /> : (
        <DataTable head={["Status", "Course", "Price", "Period", ""]} min={760}
          empty={!sales.data.length ? <p className="p-6 text-center text-sm text-muted"><Tag className="mr-1 inline size-4" />No instructor sales {salesStatus === "open" ? "running or scheduled" : "yet"}.</p> : null}>
          {sales.data.map((s) => {
            const open = s.status === "active" || s.status === "scheduled";
            return (
              <tr key={s.id}>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusClass[s.status]}`}>{statusLabel[s.status]}</span></td>
                <td className="px-4 py-3"><Link href={`/courses/${s.course.slug}`} className="font-bold hover:text-violet">{s.course.title}</Link><span className="block text-muted">{s.instructor.name}</span></td>
                <td className="px-4 py-3 tabular-nums"><b>{moneyExact(s.salePriceCents)}</b> <s className="text-muted">{moneyExact(s.listPriceCents)}</s><span className="block text-xs text-rose">−{s.percentOff}%</span></td>
                <td className="px-4 py-3 text-ink-2">{fmtWhen(s.startsAt)} to {fmtWhen(s.endsAt)}</td>
                <td className="px-4 py-3 text-right">
                  {canEdit && open ? (confirm === s.id ? (
                    <span className="inline-flex flex-wrap items-center justify-end gap-2">
                      <input className="field !min-h-9 !w-56 !py-1 text-sm" placeholder="Reason (shown in the audit log)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Reason for cancelling" />
                      <button type="button" className="btn btn-sm bg-rose text-white" disabled={busy || note.trim().length < 5} onClick={() => cancelSale(s.id)}>Cancel sale</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>Keep</button>
                    </span>
                  ) : <button type="button" className="btn btn-ghost btn-sm text-rose" onClick={() => { setConfirm(s.id); setNote(""); }}>Cancel…</button>) : null}
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </>
  );
}
