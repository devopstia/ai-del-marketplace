"use client";
import Link from "next/link";
import { useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { qs } from "@/lib/qs";
import { date } from "@/lib/format";
import { API_URL } from "@/lib/config";
import { PageHead, DataTable } from "@/components/shell/AppShell";
import { Skeleton } from "@/components/Empty";
import { useDebounced } from "@/components/Pager";
import { useToast } from "@/components/Toast";

interface Row { code: string; issuedAt: string; status: "valid" | "revoked"; revokedAt: string | null; revokedReason: string | null; student: { id: string; name: string }; course: { title: string; slug: string } }
const mapList = (r: unknown) => ({ total: Number(obj(r).total ?? 0), items: (obj(r).items as Row[]) ?? [] });

/**
 * Super Admin › Certificates (docs/CERTIFICATES.md): the official template, every issued certificate with search, and
 * revoke / restore (reason + authenticator code, audited). Issuance is automatic; nobody signs or creates certificates.
 */
export default function CertificatesAdmin() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim(), 300);
  const list = useApi(`/admin/certificates${qs({ q: dq || undefined })}`, mapList);
  const [change, setChange] = useState<{ row: Row; to: "revoke" | "restore" } | null>(null);
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!change) return;
    setBusy(true);
    try {
      await api(`/admin/certificates/${encodeURIComponent(change.row.code)}/${change.to}`, { method: "POST", body: { reason: reason.trim(), code: code.trim() || undefined } });
      toast("ok", change.to === "revoke" ? "Certificate revoked. The public check now says Revoked." : "Certificate restored.");
      setChange(null); setReason(""); setCode(""); list.reload();
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
  }
  async function rerender(r: Row) {
    try { await api(`/admin/certificates/${encodeURIComponent(r.code)}/rerender`, { method: "POST" }); toast("ok", "Redrawn with the current name, title and template. The ID is unchanged."); } catch (e) { toast("error", errMsg(e)); }
  }

  return (
    <div className="max-w-6xl">
      <PageHead title="Certificates" sub="Certificates are issued automatically when a learner completes every lesson, signed with the official DevOps Easy Learning seal. Anyone can check one by its QR code or ID." />

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]" aria-labelledby="tpl-h">
        {/* eslint-disable-next-line @next/next/no-img-element -- the official template drawn by the API with sample data */}
        <img src={`${API_URL}/admin/certificates/template.svg`} alt="The official certificate template with sample data" className="h-auto w-full rounded-md shadow-lift ring-1 ring-black/5" data-qa-on-media width={1100} height={850} />
        <div className="min-w-0">
          <h2 id="tpl-h" className="font-display text-lg font-bold">Official template: Academic Excellence</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
            <li>One landscape page, US Letter or A4; PDF and PNG are the same drawing as this preview.</li>
            <li>Signed automatically: the official seal and &ldquo;Authorized Representative · DevOps Easy Learning&rdquo;. No handwritten signatures.</li>
            <li>Its QR code opens the public check for that ID; the footer link &ldquo;Verify a certificate&rdquo; checks by ID.</li>
            <li>One official design for every course. Changing it is a code change (docs/CERTIFICATES.md), approved by the owner.</li>
          </ul>
          <p className="mt-3 text-sm"><Link href="/certificates/verify" className="link">Open the public check page</Link></p>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="issued-h">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="issued-h" className="font-display text-lg font-bold">Issued certificates{list.data ? ` (${list.data.total})` : ""}</h2>
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <label className="sr-only" htmlFor="cert-q">Search certificates</label>
            <input id="cert-q" className="field pl-9" placeholder="Student, course or certificate ID" value={q} onChange={(e) => setQ(e.target.value)} data-testid="cert-search" />
          </div>
        </div>

        {change ? (
          <div className="mt-4 rounded-panel border border-line bg-surface p-5" role="dialog" aria-labelledby="chg-h" data-testid="cert-change">
            <h3 id="chg-h" className="font-bold">{change.to === "revoke" ? "Revoke" : "Restore"} {change.row.code}: {change.row.student.name}, {change.row.course.title}</h3>
            <p className="mt-1 text-sm text-ink-2">{change.to === "revoke" ? "The public check will say Revoked and the downloads will carry a REVOKED mark. The record is kept." : "The certificate becomes valid again."} Recorded in the audit log.</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1"><label className="label" htmlFor="chg-reason">Reason</label><input id="chg-reason" className="field" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} /></div>
              <div><label className="label" htmlFor="chg-code">Authenticator code</label><input id="chg-code" className="field w-40" inputMode="numeric" autoComplete="one-time-code" maxLength={12} value={code} onChange={(e) => setCode(e.target.value)} /></div>
              <button type="button" className={`btn ${change.to === "revoke" ? "btn-danger" : "btn-primary"}`} disabled={busy || reason.trim().length < 3} onClick={() => void confirm()}>{busy ? <Loader2 className="size-4 animate-spin" /> : null}{change.to === "revoke" ? "Revoke certificate" : "Restore certificate"}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setChange(null)}>Cancel</button>
            </div>
          </div>
        ) : null}

        <div className="mt-4">
          {list.loading && !list.data ? <Skeleton className="h-40" /> : null}
          {list.error ? <p className="text-rose">{list.error}</p> : null}
          {list.data ? (
            <DataTable head={["Certificate", "Student", "Course", "Issued", "Status", ""]} min={860} empty={list.data.items.length ? undefined : <p className="p-6 text-ink-2">{dq ? "No certificate matches this search." : "No certificates issued yet."}</p>}>
              {list.data.items.map((r) => (
                <tr key={r.code} data-testid="cert-row">
                  <td className="whitespace-nowrap px-4 py-3 font-bold tracking-wide"><Link href={`/certificates/${r.code}`} className="hover:text-violet">{r.code}</Link></td>
                  <td className="px-4 py-3">{r.student.name}</td>
                  <td className="px-4 py-3">{r.course.title}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{date(r.issuedAt)}</td>
                  <td className="px-4 py-3">{r.status === "revoked" ? <span className="font-bold text-rose" title={r.revokedReason ?? undefined}>Revoked{r.revokedAt ? ` ${date(r.revokedAt)}` : ""}</span> : <span className="font-bold text-mint">Valid</span>}</td>
                  <td className="px-4 py-3 text-right"><span className="inline-flex gap-1">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void rerender(r)} title="Redraw with the current name, title and template"><RefreshCw className="size-4" />Re-render</button>
                    {r.status === "revoked"
                      ? <button type="button" className="btn btn-outline btn-sm" onClick={() => setChange({ row: r, to: "restore" })}>Restore</button>
                      : <button type="button" className="btn btn-outline btn-sm" onClick={() => setChange({ row: r, to: "revoke" })} data-testid="cert-revoke">Revoke</button>}
                  </span></td>
                </tr>
              ))}
            </DataTable>
          ) : null}
        </div>
      </section>
    </div>
  );
}
