"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Lock, ShieldCheck } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { PageHead } from "@/components/shell/AppShell";
import { Skeleton } from "@/components/Empty";
import { StackTable } from "@/components/StackTable";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";

interface Perm { key: string; description: string; allowed: boolean; default: boolean }
interface Capability { key: string; description: string; enabled: boolean }
interface RoleRow { key: "super_admin" | "admin" | "instructor" | "student"; label: string; description: string; system: boolean; members: number; permissions?: Perm[]; capabilities?: Capability[]; alwaysIncluded?: string[] }

const toRoles = (r: unknown): RoleRow[] => ((obj(r).roles as RoleRow[]) ?? []);

/**
 * Super Admin › Role management (owner 2026-11-26): what each role may do. Super Admin is a locked system role. Role
 * assignment stays in Users and roles. Changes need the authenticator code, apply on the next request, and are audited.
 */
export default function RoleManagement() {
  const { me } = useAuth();
  const toast = useToast();
  const superAdmin = !!me?.roles.includes("super_admin");
  const { data, error, reload } = useApi("/admin/people/roles", toRoles);
  const [allowed, setAllowed] = useState<string[]>([]);
  const [defaults, setDefaults] = useState<string[]>([]);
  const [disabled, setDisabled] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const saved = useMemo(() => {
    const admin = data?.find((r) => r.key === "admin");
    const caps = (data ?? []).flatMap((r) => r.capabilities ?? []);
    return {
      allowed: (admin?.permissions ?? []).filter((p) => p.allowed).map((p) => p.key),
      defaults: (admin?.permissions ?? []).filter((p) => p.default).map((p) => p.key),
      disabled: caps.filter((c) => !c.enabled).map((c) => c.key),
    };
  }, [data]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start the editor from the saved settings
    setAllowed(saved.allowed); setDefaults(saved.defaults); setDisabled(saved.disabled);
  }, [saved]);

  const same = (a: string[], b: string[]) => [...a].sort().join() === [...b].sort().join();
  const changed = !!data && !(same(allowed, saved.allowed) && same(defaults, saved.defaults) && same(disabled, saved.disabled));
  const toggle = (list: string[], set: (v: string[]) => void, key: string, on: boolean) => set(on ? [...list, key] : list.filter((k) => k !== key));

  async function save() {
    setBusy(true);
    try {
      await api("/admin/people/roles", { method: "PUT", body: { adminAllowed: allowed, adminDefaults: defaults.filter((d) => allowed.includes(d)), disabled, code: code.trim() || undefined, reason: reason.trim() || undefined } });
      toast("ok", "Role permissions saved. They apply from the next click everyone makes.");
      setCode(""); setReason(""); reload();
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <div className="max-w-5xl">
      <PageHead title="Role management" sub="What each role may do. Super Admin is a locked system role. Assign roles to people in Users and roles." actions={<Link href="/admin/users" className="btn btn-outline btn-sm">Users and roles</Link>} />
      {error ? <p className="text-rose">{error}</p> : null}
      {!data ? (!error ? <Skeleton className="h-96" /> : null) : (
        <div className="space-y-6" data-testid="role-management">
          {data.map((r) => (
            <section key={r.key} className={`rounded-panel border border-line bg-surface ${r.system ? "opacity-90" : ""}`} aria-labelledby={`role-${r.key}`} data-testid={`role-card-${r.key}`}>
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
                <div className="min-w-0">
                  <h2 id={`role-${r.key}`} className="flex items-center gap-2 font-display text-lg font-bold">
                    {r.system ? <Lock className="size-4 text-muted" aria-hidden="true" /> : null}{r.label}
                    {r.system ? <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-ink-2">System role · locked</span> : null}
                  </h2>
                  <p className="mt-0.5 text-sm text-ink-2">{r.description}</p>
                </div>
                <p className="text-sm text-muted"><b className="font-display text-lg text-ink tabular-nums">{r.members}</b> {r.members === 1 ? "person" : "people"}</p>
              </header>

              {r.system ? (
                <ul className="grid gap-x-6 gap-y-1.5 px-5 py-4 text-sm text-muted sm:grid-cols-2">
                  {(r.alwaysIncluded ?? []).map((x) => <li key={x} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{x}</li>)}
                  <li className="sm:col-span-2 mt-1 text-xs">Nobody can change or remove the Super Admin role, and the last active Super Admin can’t be removed.</li>
                </ul>
              ) : null}

              {r.permissions ? (
                <div className="px-5 py-4">
                  <p className="text-sm text-ink-2">Turn a permission off to withhold it from <b>every</b> admin at once (what each admin was given is kept). “New admins start with” is what you get when you make someone an admin.</p>
                  <StackTable className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm sm:min-w-[520px]">
                      <thead><tr className="text-left text-xs text-muted"><th className="py-2 pr-3 font-bold">Permission</th><th className="w-28 py-2 pr-3 font-bold">Allowed</th><th className="w-36 py-2 font-bold">New admins start with</th></tr></thead>
                      <tbody className="divide-y divide-line">
                        {r.permissions.map((p) => (
                          <tr key={p.key}>
                            <td className="py-2 pr-3 text-ink-2">{p.description}</td>
                            <td className="py-2 pr-3"><input type="checkbox" className="size-5 accent-[var(--violet)]" aria-label={`Allow for admins: ${p.description}`} disabled={!superAdmin} checked={allowed.includes(p.key)} onChange={(e) => toggle(allowed, setAllowed, p.key, e.target.checked)} data-testid={`allow-${p.key}`} /></td>
                            <td className="py-2"><input type="checkbox" className="size-5 accent-[var(--violet)]" aria-label={`New admins start with: ${p.description}`} disabled={!superAdmin || !allowed.includes(p.key)} checked={defaults.includes(p.key) && allowed.includes(p.key)} onChange={(e) => toggle(defaults, setDefaults, p.key, e.target.checked)} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </StackTable>
                </div>
              ) : null}

              {r.capabilities ? (
                <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-bold text-ink">Can be turned off</p>
                    <ul className="mt-2 space-y-2">
                      {r.capabilities.map((c) => {
                        const on = !disabled.includes(c.key);
                        return (
                          <li key={c.key}>
                            <label className="flex gap-2.5 text-sm">
                              <input type="checkbox" className="mt-0.5 size-5 accent-[var(--violet)]" disabled={!superAdmin} checked={on} onChange={(e) => toggle(disabled, setDisabled, c.key, !e.target.checked)} data-testid={`cap-${c.key}`} />
                              <span className={on ? "text-ink-2" : "text-muted line-through"}>{c.description}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ink">Always included</p>
                    <ul className="mt-2 space-y-1.5 text-sm text-muted">{(r.alwaysIncluded ?? []).map((x) => <li key={x} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{x}</li>)}</ul>
                  </div>
                </div>
              ) : null}
            </section>
          ))}

          {!superAdmin ? <p className="text-sm text-muted">Only a super admin can change role permissions.</p> : changed ? (
            <section className="sticky bottom-3 z-10 rounded-panel border border-violet bg-surface p-4 shadow-float" aria-label="Save role permissions" data-testid="save-roles-bar">
              <p className="text-sm text-ink">This changes what people can do right away. It is kept in the audit log.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
                <div className="min-w-0"><label className="label" htmlFor="roles-reason">Reason (optional)</label><input id="roles-reason" className="field" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For the audit log" /></div>
                <div><label className="label" htmlFor="roles-code"><Lock className="mr-1 inline size-3.5" />Authenticator code</label><input id="roles-code" className="field tabular-nums" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="6 digits" data-testid="roles-code" /></div>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-ghost" onClick={() => { setAllowed(saved.allowed); setDefaults(saved.defaults); setDisabled(saved.disabled); }}>Undo</button>
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()} data-testid="save-roles">{busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}Save</button>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
