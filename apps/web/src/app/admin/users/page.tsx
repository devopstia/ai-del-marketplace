"use client";
import { useEffect, useState } from "react";
import { BadgeCheck, CircleAlert, KeyRound, Loader2, Lock, ShieldCheck } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { qs } from "@/lib/qs";
import { date, dateTime } from "@/lib/format";
import type { Role } from "@/lib/types";
import { PageHead, DataTable } from "@/components/shell/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Avatar } from "@/components/Avatar";
import { Skeleton } from "@/components/Empty";
import { Modal } from "@/components/Modal";
import { Pager, useDebounced } from "@/components/Pager";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";
import { canDo } from "@/lib/studios";
import { UserAccountTools } from "@/components/admin/UserAccountTools";

type Status = "active" | "suspended" | "disabled" | "deleted";
interface Row {
  id: string; name: string; email: string; roles: Role[]; status: Status; createdAt: string; signupMethod: string; suspendedUntil?: string | null;
  emailVerified: boolean; mfaEnabled: boolean; adminPermissions: string[]; instructorProfile?: { status: string } | null;
}
interface Detail extends Row {
  history: { id: string; action: string; at: string; actor: { id: string; name: string } | null; meta: Record<string, unknown> }[]; identities: { provider: string }[];
  lastLoginAt: string | null; activeSessions: number; statusReason: string | null; hasPassword: boolean; locked: boolean; mustChangePassword: boolean; suspensionEnded: boolean;
}
interface Catalogue { roles: { key: Role; label: string; description: string }[]; permissions: { key: string; description: string }[]; defaultAdminPermissions: string[]; superAdminOnly: string[] }

const ROLE_LABEL: Record<Role, string> = { student: "Student", instructor: "Instructor", admin: "Admin", super_admin: "Super Admin" };
const METHOD: Record<string, string> = { email: "Email", google: "Google", github: "GitHub", facebook: "Facebook", linkedin: "LinkedIn", invitation: "Invitation", seed: "Created by DEL" };
const ACTION: Record<string, string> = {
  "user.access_changed": "Roles changed", "user.updated": "Account changed", "user.suspended": "Suspended", "user.reactivated": "Reactivated",
  "instructor.applied": "Applied to teach", "instructor.approved": "Instructor approved", "instructor.rejected": "Application rejected",
  "instructor.needs_info": "More information requested", "instructor.under_review": "Application under review", "auth.register": "Registered", "auth.mfa_reset": "Two-step sign-in reset",
  "user.disabled": "Disabled", "user.deleted": "Deleted", "user.email_changed": "Email changed", "user.password_reset_sent": "Password reset email sent",
  "user.verification_sent": "Verification email sent", "user.recovery_link_created": "Recovery link created", "user.temporary_password_set": "Temporary password set",
  "user.sessions_revoked": "Signed out everywhere", "auth.password_reset": "Password reset", "auth.password_changed": "Password changed",
};
const STATUSES: Status[] = ["active", "suspended", "disabled", "deleted"];
const toRow = (x: unknown): Row => {
  const o = obj(x);
  return { id: String(o.id), name: String(o.name ?? ""), email: String(o.email ?? ""), roles: (o.roles as Role[]) ?? ["student"], status: (STATUSES as string[]).includes(String(o.status)) ? (o.status as Status) : "active", suspendedUntil: (o.suspendedUntil as string | null) ?? null, createdAt: String(o.createdAt ?? ""), signupMethod: String(o.signupMethod ?? "email"), emailVerified: !!o.emailVerified || !!o.emailVerifiedAt, mfaEnabled: !!o.mfaEnabled, adminPermissions: (o.adminPermissions as string[]) ?? [], instructorProfile: (o.instructorProfile as Row["instructorProfile"]) ?? null };
};

function RoleChips({ roles }: { roles: Role[] }) {
  const order: Role[] = ["super_admin", "admin", "instructor", "student"];
  return (
    <span className="flex flex-wrap gap-1.5">
      {order.filter((r) => roles.includes(r)).map((r) => (
        <span key={r} className={`rounded-full px-2 py-0.5 text-xs font-bold ${r === "super_admin" ? "bg-rose-soft text-rose" : r === "admin" ? "bg-amber-soft text-amber" : r === "instructor" ? "bg-violet-soft text-violet" : "bg-surface-2 text-ink-2"}`}>{ROLE_LABEL[r]}</span>
      ))}
    </span>
  );
}

export default function UsersAndRoles() {
  const { me } = useAuth();
  const superAdmin = !!me?.roles.includes("super_admin");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [method, setMethod] = useState("");
  const [since, setSince] = useState<string | undefined>(undefined);
  const recent = !!since;
  const [page, setPage] = useState(1);
  const dq = useDebounced(q.trim());
  const { data, error, reload } = useApi(`/admin/people/users${qs({ q: dq.length > 1 ? dq : undefined, role: role || undefined, status: status || undefined, method: method || undefined, since, page, pageSize: 25 })}`, (r) => ({ ...(obj(r) as { page: number; pageSize: number; total: number }), items: (obj(r).items as unknown[] ?? []).map(toRow) }));
  const summary = useApi("/admin/people/summary", (r) => obj(r) as Record<string, number>);
  const catalogue = useApi("/admin/people/catalogue", (r) => r as Catalogue);
  const [open, setOpen] = useState<string | null>(null);
  const s = summary.data;
  const stats = s ? [
    ["Registered users", s.total], ["Students", s.students], ["Instructors", s.instructors], ["Admins", s.admins + (s.superAdmins ?? 0)],
    ["Pending applications", s.pendingApplications], ["New this week", s.newThisWeek], ["Suspended or disabled", s.suspended],
  ] as [string, number][] : null;

  return (
    <>
      <PageHead title="Users and roles" sub={superAdmin ? "Everyone who registered, their roles and how they signed up. Role changes need your authenticator code and are kept in each account’s history." : "Everyone who registered. Only a super admin changes roles."} />
      {stats ? (
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-4 xl:grid-cols-7" data-testid="user-stats">
          {stats.map(([l, v], i) => (
            // 7 tiles: the last one fills the row on phones (2 columns) and tablets (4 columns), so no empty cell shows
            <div key={l} className={`bg-surface p-4 ${i === stats.length - 1 && stats.length % 2 ? "col-span-2 xl:col-span-1" : ""}`}>
              <dt className="text-xs text-muted">{l}</dt>
              <dd className="mt-1 font-display text-2xl font-extrabold tabular-nums">{v ?? 0}</dd>
            </div>
          ))}
        </dl>
      ) : <Skeleton className="h-20" />}

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <input type="search" aria-label="Search users" className="field !w-72 max-w-full" placeholder="Search name or email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select aria-label="Role" className="field !w-auto" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">All roles</option><option value="student_only">Students only</option><option value="instructor">Instructors</option><option value="admin">Admins</option><option value="super_admin">Super Admins</option>
        </select>
        <select aria-label="Status" className="field !w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Any status</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="disabled">Disabled</option><option value="deleted">Deleted</option>
        </select>
        <select aria-label="Sign-up method" className="field !w-auto" value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }}>
          <option value="">Any sign-up</option>{Object.entries(METHOD).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm font-bold text-ink-2"><input type="checkbox" checked={recent} onChange={(e) => { setSince(e.target.checked ? new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10) : undefined); setPage(1); }} className="size-4 accent-[var(--violet)]" />New this week</label>
      </div>

      {error ? <p className="mt-4 text-rose">{error}</p> : null}
      <div className="mt-4">
        {data ? (
          <>
            <DataTable head={["User", "Roles", "Signed up with", "Security", "Status", "Joined", ""]} min={980} empty={!data.items.length ? <p className="px-4 py-10 text-center text-ink-2">No users match.</p> : null}>
              {data.items.map((u) => (
                <tr key={u.id} data-testid="user-row">
                  <td className="px-4 py-3"><span className="flex items-center gap-3"><Avatar name={u.name} size={32} /><span className="min-w-0"><span className="block font-bold">{u.name}</span><span className="text-xs text-muted">{u.email}</span></span></span></td>
                  <td className="px-4 py-3"><RoleChips roles={u.roles} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-2">{METHOD[u.signupMethod] ?? u.signupMethod}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs">
                    <span className={`mr-3 inline-flex items-center gap-1 font-bold ${u.emailVerified ? "text-mint" : "text-muted"}`}><BadgeCheck className="size-3.5" />{u.emailVerified ? "Email verified" : "Not verified"}</span>
                    <span className={`inline-flex items-center gap-1 font-bold ${u.mfaEnabled ? "text-mint" : "text-amber"}`}><KeyRound className="size-3.5" />{u.mfaEnabled ? "2-step on" : "2-step not set"}</span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={u.status} />{u.status === "suspended" && u.suspendedUntil ? <span className="mt-0.5 block text-xs text-muted">until {date(u.suspendedUntil)}</span> : null}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-2">{date(u.createdAt)}</td>
                  <td className="px-4 py-3 text-right"><button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(u.id)} data-testid="manage-user" aria-label={`Manage ${u.name}`}>{u.status === "deleted" ? "View" : canDo(me, "users.manage") ? "Manage" : "View"}</button></td>
                </tr>
              ))}
            </DataTable>
            <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} noun="users" />
          </>
        ) : !error ? <Skeleton className="h-80" /> : null}
      </div>
      {open && catalogue.data ? <ManageUser id={open} catalogue={catalogue.data} onClose={() => setOpen(null)} onChanged={() => { reload(); summary.reload(); }} /> : null}
    </>
  );
}

function ManageUser({ id, catalogue, onClose, onChanged }: { id: string; catalogue: Catalogue; onClose: () => void; onChanged: () => void }) {
  const { me } = useAuth();
  const toast = useToast();
  const superAdmin = !!me?.roles.includes("super_admin");
  const self = me?.id === id;
  const { data: u, reload } = useApi(`/admin/people/users/${id}`, (r) => {
    const o = obj(r);
    return { ...toRow(r), history: (o.history as Detail["history"]) ?? [], identities: (o.identities as Detail["identities"]) ?? [], lastLoginAt: (o.lastLoginAt as string | null) ?? null, activeSessions: Number(o.activeSessions ?? 0), statusReason: (o.statusReason as string | null) ?? null, hasPassword: o.hasPassword !== false, locked: !!o.locked, mustChangePassword: !!o.mustChangePassword, suspensionEnded: !!o.suspensionEnded } as Detail;
  });
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    if (!u) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start the editor from the saved roles
    setRoles(u.roles);
    setPerms(u.adminPermissions.length ? u.adminPermissions : catalogue.defaultAdminPermissions);
  }, [u, catalogue.defaultAdminPermissions]);

  const added = roles.filter((r) => u && !u.roles.includes(r));
  const removed = (u?.roles ?? []).filter((r) => !roles.includes(r));
  const isAdminOnly = roles.includes("admin") && !roles.includes("super_admin");
  const permsChanged = !!u && isAdminOnly && perms.slice().sort().join() !== u.adminPermissions.slice().sort().join();
  const privileged = [...added, ...removed].some((r) => r === "admin" || r === "super_admin") || permsChanged;
  const changed = added.length || removed.length || permsChanged;
  const toggle = (r: Role) => setRoles((rs) => {
    let next = rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r];
    if (r === "super_admin" && next.includes("super_admin") && !next.includes("admin")) next = [...next, "admin"];
    if (r === "admin" && !next.includes("admin")) next = next.filter((x) => x !== "super_admin");
    return next;
  });

  async function save() {
    setBusy("save");
    try {
      await api(`/admin/people/users/${id}/access`, { method: "PUT", body: { roles: roles.filter((r) => r !== "student"), adminPermissions: isAdminOnly ? perms : undefined, code: privileged ? code.trim() || undefined : undefined, reason: reason.trim() || undefined } });
      toast("ok", "Roles saved. The change applies right away and is in the account history.");
      setCode(""); setReason(""); reload(); onChanged();
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); }
  }
  return (
    <Modal open onClose={onClose} title={u ? u.name : "User"} wide>
      {!u ? <div className="p-6"><Skeleton className="h-60" /></div> : (
        <div className="max-h-[78vh] space-y-6 overflow-y-auto p-5 sm:p-6" data-testid="manage-dialog">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={u.name} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{u.email}</p>
              <p className="text-sm text-muted">Joined {date(u.createdAt)} with {METHOD[u.signupMethod] ?? u.signupMethod}{u.identities.length ? ` · linked: ${u.identities.map((i) => METHOD[i.provider] ?? i.provider).join(", ")}` : ""}</p>
            </div>
            <StatusBadge status={u.status} />
          </div>
          <dl className="grid grid-cols-2 gap-3 rounded-tile border border-line p-3 text-sm sm:grid-cols-4" data-testid="user-facts">
            <div><dt className="text-xs text-muted">Last sign-in</dt><dd className="font-bold">{u.lastLoginAt ? dateTime(u.lastLoginAt) : "Never"}</dd></div>
            <div><dt className="text-xs text-muted">Signed in on</dt><dd className="font-bold tabular-nums">{u.activeSessions} device{u.activeSessions === 1 ? "" : "s"}</dd></div>
            <div><dt className="text-xs text-muted">Email</dt><dd className={`font-bold ${u.emailVerified ? "text-mint" : "text-amber"}`}>{u.emailVerified ? "Verified" : "Not verified"}</dd></div>
            <div><dt className="text-xs text-muted">Two-step sign-in</dt><dd className={`font-bold ${u.mfaEnabled ? "text-mint" : "text-amber"}`}>{u.mfaEnabled ? "On" : "Not set up"}</dd></div>
          </dl>
          {u.status !== "active" || u.locked || u.mustChangePassword ? (
            <p className="rounded-tile bg-amber-soft px-3 py-2 text-sm text-amber" data-testid="user-status-note">
              {u.status === "suspended" ? <>Suspended{u.suspendedUntil ? ` until ${dateTime(u.suspendedUntil)}${u.suspensionEnded ? " (ended: active again at the next sign-in)" : ""}` : " until reactivated"}. </> : null}
              {u.status === "disabled" ? <>Disabled until turned on again. </> : null}
              {u.status === "deleted" ? <>This account was deleted. Its orders and records are kept. </> : null}
              {u.statusReason ? <>Reason: “{u.statusReason}”. </> : null}
              {u.locked ? <>Locked for a few minutes after too many wrong passwords. </> : null}
              {u.mustChangePassword ? <>Must choose a new password at the next sign-in. </> : null}
            </p>
          ) : null}

          <section aria-labelledby="roles-h">
            <h3 id="roles-h" className="font-display text-lg font-bold">Roles</h3>
            {self ? <p className="mt-1 text-sm text-muted">You can’t change your own roles. Another super admin can.</p> : !superAdmin ? <p className="mt-1 text-sm text-muted">Only a super admin can change roles.</p> : null}
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {catalogue.roles.map((r) => {
                const on = roles.includes(r.key);
                const fixed = r.key === "student" || !superAdmin || self;
                return (
                  <li key={r.key}>
                    <label className={`flex h-full gap-3 rounded-tile border p-3 ${on ? "border-violet bg-violet-soft/50" : "border-line"} ${fixed ? "opacity-80" : "cursor-pointer hover:border-violet"}`}>
                      <input type="checkbox" className="mt-1 size-4 accent-[var(--violet)]" checked={on} disabled={fixed} onChange={() => toggle(r.key)} data-testid={`role-${r.key}`} />
                      <span><span className="block font-bold text-ink">{r.label}{r.key === "student" ? <span className="ml-2 text-xs font-normal text-muted">every account</span> : null}</span><span className="text-sm text-ink-2">{r.description}</span></span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

          {isAdminOnly ? (
            <section aria-labelledby="perm-h">
              <h3 id="perm-h" className="font-display text-lg font-bold">Admin permissions</h3>
              <p className="mt-1 text-sm text-ink-2">Choose what this admin may do. They can never change roles, commission, payment settings or security policy.</p>
              <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {catalogue.permissions.map((p) => (
                  <li key={p.key}>
                    <label className="flex gap-2.5 text-sm">
                      <input type="checkbox" className="mt-0.5 size-4 accent-[var(--violet)]" disabled={!superAdmin || self} checked={perms.includes(p.key)} onChange={(e) => setPerms((ps) => (e.target.checked ? [...ps, p.key] : ps.filter((x) => x !== p.key)))} data-testid={`perm-${p.key}`} />
                      <span className="text-ink-2">{p.description}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <details className="mt-3 text-sm text-muted"><summary className="cursor-pointer font-bold">Super Admin only</summary><ul className="mt-2 list-disc space-y-1 pl-5">{catalogue.superAdminOnly.map((x) => <li key={x}>{x}</li>)}</ul></details>
            </section>
          ) : null}

          {superAdmin && !self && changed ? (
            <section className="rounded-tile border border-line bg-surface-2/60 p-4" aria-label="Confirm the change" data-testid="confirm-access">
              <p className="text-sm text-ink">
                {added.length ? <>Adding <b>{added.map((r) => ROLE_LABEL[r]).join(", ")}</b>. </> : null}
                {removed.length ? <>Removing <b>{removed.map((r) => ROLE_LABEL[r]).join(", ")}</b>{removed.some((r) => r === "admin" || r === "super_admin") ? " (signs them out everywhere)" : ""}. </> : null}
                {permsChanged ? <>Changing admin permissions. </> : null}
                It applies right away.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div><label className="label" htmlFor="reason">Reason {added.includes("instructor") && !u.instructorProfile ? "(required)" : "(optional)"}</label><input id="reason" className="field" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For the account history" /></div>
                {privileged ? <div><label className="label" htmlFor="stepup"><Lock className="mr-1 inline size-3.5" />Your authenticator code</label><input id="stepup" className="field tabular-nums" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="6 digits" data-testid="stepup-code" /></div> : null}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className="btn btn-ghost" onClick={() => { setRoles(u.roles); setPerms(u.adminPermissions); }}>Undo</button>
                <button type="button" className="btn btn-primary" disabled={!!busy || (privileged && code.length < 6)} onClick={save} data-testid="save-access">{busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}Save roles</button>
              </div>
            </section>
          ) : null}

          {!self && u.status !== "deleted" && canDo(me, "users.manage") && !(u.roles.some((r) => r === "admin" || r === "super_admin") && !superAdmin) ? (
            <UserAccountTools user={u} superAdmin={superAdmin} onChanged={() => { reload(); onChanged(); }} onDeleted={() => { onChanged(); onClose(); }} />
          ) : null}

          <section aria-labelledby="hist-h">
            <h3 id="hist-h" className="font-display text-lg font-bold">History</h3>
            {u.history.length ? (
              <ol className="mt-2 divide-y divide-line text-sm" data-testid="user-history">
                {u.history.map((h) => {
                  const m = h.meta ?? {};
                  const detail = h.action === "user.access_changed"
                    ? [((m.added as Role[]) ?? []).length ? `added ${(m.added as Role[]).map((r) => ROLE_LABEL[r]).join(", ")}` : "", ((m.removed as Role[]) ?? []).length ? `removed ${(m.removed as Role[]).map((r) => ROLE_LABEL[r]).join(", ")}` : "", m.reason ? `“${String(m.reason)}”` : ""].filter(Boolean).join(" · ")
                    : m.note ? `“${String(m.note)}”` : m.reason ? `“${String(m.reason)}”` : "";
                  return (
                    <li key={h.id} className="flex flex-wrap gap-x-3 py-2">
                      <span className="w-36 shrink-0 text-muted">{dateTime(h.at)}</span>
                      <span className="min-w-0 flex-1"><b className="text-ink">{ACTION[h.action] ?? h.action}</b>{detail ? <span className="text-ink-2"> · {detail}</span> : null}{h.actor ? <span className="text-muted"> · by {h.actor.name}</span> : null}</span>
                    </li>
                  );
                })}
              </ol>
            ) : <p className="mt-2 flex items-center gap-2 text-sm text-muted"><CircleAlert className="size-4" />No changes recorded yet.</p>}
          </section>
        </div>
      )}
    </Modal>
  );
}
