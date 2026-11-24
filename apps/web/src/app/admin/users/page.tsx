"use client";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { paged, toAdminUser } from "@/lib/normalize";
import { qs } from "@/lib/qs";
import { date } from "@/lib/format";
import type { AdminUser, Role } from "@/lib/types";
import { PageHead, DataTable } from "@/components/shell/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Avatar } from "@/components/Avatar";
import { Skeleton } from "@/components/Empty";
import { Modal } from "@/components/Modal";
import { Pager, useDebounced } from "@/components/Pager";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";

const map = (r: unknown) => paged(r, toAdminUser, "users");
const ROLES: Role[] = ["student", "instructor", "admin", "super_admin"];
const roleName = (r: Role) => r.replace("_", " ");
const roleEffect: Record<Role, string> = {
  student: "can buy and take courses.",
  instructor: "can create courses in the studio and receive payouts.",
  admin: "can review courses, refund orders, suspend users and see the audit log.",
  super_admin: "has full control, including changing other people’s roles and the commission.",
};

type Pending = { kind: "role"; user: AdminUser; role: Role; add: boolean } | { kind: "status"; user: AdminUser; status: "active" | "suspended" };

export default function AdminUsers() {
  const toast = useToast();
  const { me, has } = useAuth();
  const superAdmin = !!me?.roles.includes("super_admin");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounced(q.trim());
  const { data, error, reload } = useApi(`/admin/users${qs({ q: dq.length > 1 ? dq : undefined, page, pageSize: 25 })}`, map);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  async function apply() {
    if (!pending) return;
    const u = pending.user;
    const body = pending.kind === "role"
      ? { roles: pending.add ? [...u.roles, pending.role] : u.roles.filter((x) => x !== pending.role) }
      : { status: pending.status };
    setBusy(true);
    try {
      await api(`/admin/users/${u.id}`, { method: "PATCH", body });
      toast("ok", pending.kind === "role" ? `${u.name}: ${roleName(pending.role)} role ${pending.add ? "added" : "removed"}.` : `${u.name} ${pending.status === "suspended" ? "suspended" : "reactivated"}.`);
      setPending(null);
      reload();
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHead title="Users" sub={superAdmin ? "Suspend accounts and manage roles. Every change asks for confirmation and is written to the audit log." : "Suspend or reactivate accounts. Only a super admin can change roles."} />
      <input type="search" aria-label="Search users" className="field mb-4 !w-80 max-w-full" placeholder="Search name or email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      {error ? <p className="text-rose">{error}</p> : null}
      {data ? (
        <>
          <DataTable head={["User", "Roles", "Status", "Joined", ""]} min={820} empty={!data.items.length ? <p className="px-4 py-10 text-center text-ink-2">No users match.</p> : null}>
            {data.items.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3"><span className="flex items-center gap-3"><Avatar name={u.name} size={32} /><span><span className="block font-bold">{u.name}</span><span className="text-xs text-muted">{u.email}</span></span></span></td>
                <td className="px-4 py-3">
                  {superAdmin && u.id !== me?.id ? (
                    <span className="flex flex-wrap gap-1.5" role="group" aria-label={`Roles of ${u.name}`}>
                      {ROLES.map((r) => {
                        const on = u.roles.includes(r);
                        // Every account keeps the student role (the API always adds it), so it is not a toggle.
                        if (r === "student") return <span key={r} className="chip inline-flex items-center gap-1 !bg-surface-2"><Check className="size-3" strokeWidth={3} />student</span>;
                        return (
                          <button key={r} type="button" aria-pressed={on} onClick={() => setPending({ kind: "role", user: u, role: r, add: !on })}
                            className={`chip inline-flex items-center gap-1 border ${on ? "!border-violet !bg-violet-soft !text-violet" : "border-dashed border-line-strong !bg-transparent text-muted"}`}>
                            {on ? <Check className="size-3" strokeWidth={3} /> : null}{roleName(r)}
                          </button>
                        );
                      })}
                    </span>
                  ) : <span className="flex flex-wrap gap-1.5">{u.roles.map((r) => <span key={r} className="chip">{roleName(r)}</span>)}</span>}
                </td>
                <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-ink-2">{date(u.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  {u.id !== me?.id && has("admin") ? (
                    <button type="button" className={`btn btn-sm ${u.status === "active" ? "btn-ghost text-rose" : "btn-outline"}`} onClick={() => setPending({ kind: "status", user: u, status: u.status === "active" ? "suspended" : "active" })}>
                      {u.status === "active" ? "Suspend" : "Reactivate"}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </DataTable>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} noun="users" />
        </>
      ) : !error ? <Skeleton className="h-80" /> : null}

      <Modal open={!!pending} onClose={() => setPending(null)} title={pending?.kind === "role" ? (pending.add ? "Add role" : "Remove role") : pending?.kind === "status" && pending.status === "suspended" ? "Suspend user" : "Reactivate user"}>
        {pending ? (
          <div className="space-y-4 p-5">
            <p className="text-ink-2">
              {pending.kind === "role"
                ? <>{pending.add ? "Give" : "Remove"} the <b className="text-ink">{roleName(pending.role)}</b> role {pending.add ? "to" : "from"} <b className="text-ink">{pending.user.name}</b> ({pending.user.email})? With this role a person {roleEffect[pending.role]} They are signed out so the change takes effect at their next sign-in.</>
                : pending.status === "suspended"
                  ? <>Suspend <b className="text-ink">{pending.user.name}</b> ({pending.user.email})? They are signed out everywhere and can’t sign in until reactivated. Their purchases are kept.</>
                  : <>Reactivate <b className="text-ink">{pending.user.name}</b> ({pending.user.email})? They can sign in again.</>}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setPending(null)}>Cancel</button>
              <button type="button" className={`btn ${(pending.kind === "status" && pending.status === "suspended") || (pending.kind === "role" && !pending.add) ? "btn-danger" : "btn-primary"}`} disabled={busy} onClick={apply} data-testid="confirm-user-change">
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {pending.kind === "role" ? (pending.add ? `Add ${roleName(pending.role)}` : `Remove ${roleName(pending.role)}`) : pending.status === "suspended" ? "Suspend" : "Reactivate"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
