"use client";
import Link from "next/link";
import { useState } from "react";
import { Loader2, Megaphone, Tag } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { obj, toSale } from "@/lib/normalize";
import { moneyExact } from "@/lib/format";
import type { SaleInfo } from "@/lib/types";
import { PageHead } from "@/components/shell/AppShell";
import { Empty, Skeleton } from "@/components/Empty";
import { useToast } from "@/components/Toast";
import { Price, SaleTag } from "@/components/CourseViews";
import { SaleEnds } from "@/components/SaleEnds";
import { toTerms } from "@/components/studio/TermsNote";
import { SaleForm, type SaleDraft } from "@/components/promotions/SaleForm";
import { fmtWhen, statusClass, statusLabel } from "@/components/promotions/when";

interface Row {
  id: string; title: string; slug: string; status: string; priceCents: number; maxSalePriceCents: number | null;
  current: { priceCents: number; listPriceCents: number; sale: SaleInfo | null };
  promoOptOut: boolean; platformOwned: boolean; inPromotions: string[]; upcoming: SaleDraft[];
}
interface Overview { rules: { minPercentOff: number; maxDays: number; minPriceCents: number }; promotions: { id: string; name: string; percentOff: number; endsAt: string; scope: string }[]; courses: Row[] }

const toOverview = (r: unknown): Overview => {
  const o = obj(r);
  const rules = obj(o.rules);
  return {
    rules: { minPercentOff: Number(rules.minPercentOff ?? 10), maxDays: Number(rules.maxDays ?? 31), minPriceCents: Number(rules.minPriceCents ?? 499) },
    promotions: (Array.isArray(o.promotions) ? o.promotions : []).map((p) => { const x = obj(p); return { id: String(x.id), name: String(x.name), percentOff: Number(x.percentOff), endsAt: String(x.endsAt), scope: String(x.scope) }; }),
    courses: (Array.isArray(o.courses) ? o.courses : []).map((c) => {
      const x = obj(c);
      const cur = obj(x.current);
      return {
        id: String(x.id), title: String(x.title), slug: String(x.slug), status: String(x.status), priceCents: Number(x.priceCents ?? 0),
        maxSalePriceCents: x.maxSalePriceCents == null ? null : Number(x.maxSalePriceCents),
        current: { priceCents: Number(cur.priceCents ?? x.priceCents ?? 0), listPriceCents: Number(cur.listPriceCents ?? x.priceCents ?? 0), sale: toSale(cur.sale) },
        promoOptOut: !!x.promoOptOut, platformOwned: !!x.platformOwned, inPromotions: (Array.isArray(x.inPromotions) ? x.inPromotions : []).map(String),
        upcoming: (Array.isArray(x.upcoming) ? x.upcoming : []).map((s) => { const y = obj(s); return { id: String(y.id), salePriceCents: Number(y.salePriceCents), startsAt: String(y.startsAt), endsAt: String(y.endsAt), status: String(y.status) }; }),
      };
    }),
  };
};

function CourseRow({ c, rules, share, isPlatform, promos, reload }: { c: Row; rules: Overview["rules"]; share: number; isPlatform: boolean; promos: Overview["promotions"]; reload: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<null | "new" | SaleDraft>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const paid = c.priceCents > 0;
  const canSale = paid && c.maxSalePriceCents !== null && c.maxSalePriceCents >= rules.minPriceCents;
  const reachedBy = promos.filter((p) => c.inPromotions.includes(p.id));

  async function cancel(id: string) {
    setBusy(true);
    try { await api(`/instructor/courses/${c.id}/sales/${id}/cancel`, { method: "POST" }); toast("ok", "Sale cancelled. The regular price applies again."); setConfirm(null); reload(); }
    catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
  }
  async function optOut(v: boolean) {
    setBusy(true);
    try { await api(`/instructor/courses/${c.id}/promotions`, { method: "PUT", body: { promoOptOut: v } }); toast("ok", v ? "This course is left out of marketplace promotions." : "This course joins marketplace promotions."); reload(); }
    catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <li className="py-5" data-testid="promo-course">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <Link href={`/studio/courses/${c.id}`} className="font-display text-lg font-bold text-ink hover:text-violet">{c.title}</Link>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="capitalize">{c.status.replace("_", " ")}</span>
            {c.status !== "published" && paid ? <span>Sale prices show once the course is published.</span> : null}
          </p>
        </div>
        <div className="text-right">
          {paid ? <Price cents={c.current.priceCents} listCents={c.current.listPriceCents} className="text-xl" /> : <span className="font-display text-xl font-extrabold text-mint">Free</span>}
          {c.current.sale ? <div className="mt-1"><SaleTag sale={c.current.sale} withName={c.current.sale.kind === "promotion"} /></div> : null}
        </div>
      </div>

      {c.upcoming.length ? (
        <ul className="mt-3 space-y-2">
          {c.upcoming.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusClass[s.status ?? "scheduled"]}`}>{statusLabel[s.status ?? "scheduled"]}</span>
              <span className="font-bold tabular-nums text-ink">{moneyExact(s.salePriceCents)}</span>
              <span className="text-ink-2">{s.status === "active" ? <>until {fmtWhen(s.endsAt)} (<SaleEnds endsAt={s.endsAt} />)</> : <>{fmtWhen(s.startsAt)} to {fmtWhen(s.endsAt)}</>}</span>
              <span className="ml-auto flex gap-2">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm(s)} disabled={busy}>Edit</button>
                {confirm === s.id ? (
                  <button type="button" className="btn btn-sm bg-rose text-white" onClick={() => cancel(s.id!)} disabled={busy} data-testid="confirm-cancel-sale">{busy ? <Loader2 className="size-4 animate-spin" /> : null}Yes, cancel sale</button>
                ) : (
                  <button type="button" className="btn btn-ghost btn-sm text-rose" onClick={() => setConfirm(s.id!)} disabled={busy}>Cancel sale</button>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        {canSale && !c.upcoming.length && !form ? (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setForm("new")} data-testid="put-on-sale"><Tag className="size-4" />Put on sale</button>
        ) : null}
        {!paid ? <span className="text-sm text-muted">Free courses can’t go on sale.</span> : null}
        {paid && !canSale ? <span className="text-sm text-muted">The price is too low for a sale (minimum sale price {moneyExact(rules.minPriceCents)}).</span> : null}
        {paid ? (
          c.platformOwned ? (
            <span className="text-sm text-muted">Always part of marketplace promotions (DevOps Easy Learning course).</span>
          ) : (
            <label className="flex items-center gap-2 text-sm text-ink-2">
              <input type="checkbox" className="size-4 accent-[var(--violet)]" checked={!c.promoOptOut} disabled={busy} onChange={(e) => optOut(!e.target.checked)} data-testid="promo-optin" />
              Include in marketplace promotions
            </label>
          )
        ) : null}
        {reachedBy.length ? <span className="text-sm text-ink-2">In: {reachedBy.map((p) => `${p.name} (${p.percentOff}% off)`).join(", ")}</span> : null}
      </div>

      {form && c.maxSalePriceCents ? (
        <SaleForm
          courseId={c.id} listCents={c.priceCents} maxSaleCents={c.maxSalePriceCents} minCents={rules.minPriceCents} maxDays={rules.maxDays}
          sharePercent={isPlatform ? 100 : share} who={isPlatform ? "DEL receives" : "You receive"}
          edit={form === "new" ? undefined : form}
          onDone={() => { setForm(null); reload(); }} onCancel={() => setForm(null)}
        />
      ) : null}
    </li>
  );
}

export default function PromotionsPage() {
  const { data, error, reload } = useApi("/instructor/promotions", toOverview);
  const { data: terms } = useApi("/instructor/terms", toTerms);
  return (
    <>
      <PageHead
        title="Promotions"
        sub="Put a course on sale for a set period. The sale price shows across the site with the regular price crossed out, and the regular price comes back by itself when the sale ends."
      />
      {data?.promotions.length ? (
        <div className="mb-6 flex items-start gap-3 rounded-tile border border-line bg-surface p-4">
          <Megaphone className="mt-0.5 size-5 shrink-0 text-violet" aria-hidden="true" />
          <p className="text-sm text-ink-2">
            {data.promotions.map((p, i) => <span key={p.id}>{i ? "; " : ""}<b className="text-ink">{p.name}</b>: {p.percentOff}% off {p.scope === "all" ? "every course" : "selected courses"}, <SaleEnds endsAt={p.endsAt} className="lowercase" /></span>)}.
            {" "}Learners always get the lower of your sale price and the promotion price; discounts never stack. You earn your usual share of what they pay.
          </p>
        </div>
      ) : null}
      {error ? <p className="text-rose">{error}</p> : null}
      {!data && !error ? <Skeleton className="h-72" /> : null}
      {data && !data.courses.length ? <Empty icon={Tag} title="No courses yet" body="Create a course first; you can put it on sale once it has a price." href="/studio/courses" cta="Go to courses" /> : null}
      {data && data.courses.length ? (
        <>
          <p className="mb-2 text-sm text-muted">Rules: at least {data.rules.minPercentOff}% off, not below {moneyExact(data.rules.minPriceCents)}, up to {data.rules.maxDays} days, one sale per course at a time.</p>
          <ul className="divide-y divide-line border-y border-line">
            {data.courses.map((c) => <CourseRow key={c.id} c={c} rules={data.rules} share={terms?.instructorSharePercent ?? 80} isPlatform={!!terms?.isPlatform} promos={data.promotions} reload={reload} />)}
          </ul>
        </>
      ) : null}
    </>
  );
}
