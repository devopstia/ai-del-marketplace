"use client";
import { useState } from "react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { list, toAdminUser } from "@/lib/normalize";
import { date } from "@/lib/format";
import type { AdminUser, Role } from "@/lib/types";
import { PageHead, DataTable } from "@/components/shell/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Avatar } from "@/components/Avatar";
import { Skeleton } from "@/components/Empty";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";

const map = (r: unknown) => list(r, "users").map(toAdminUser);
const ROLES: Role[] = ["student", "instructor", "admin", "super_admin"];

export default function AdminUsers() {
  const toast = useToast();
  const { me, has } = useAuth();
  const superAdmin = !!me?.roles.includes("super_admin");
  const [q, setQ] = useState("");
  const { data, error, setData } = useApi(`/admin/users?pageSize=100${q.length > 1 ? `&q=${encodeURIComponent(q)}` : ""}`, map);
  async function update(u: AdminUser, body: Partial<AdminUser>) {
    try {
      await api(`/admin/users/${u.id}`, { method: "PATCH", body });
      setData((d) => d?.map((x) => (x.id === u.id ? { ...x, ...body } : x)) ?? null);
      toast("ok", "User updated.");
    } catch (e) { toast("error", errMsg(e)); }
  }
  const shown = (data ?? []).filter((u) => !q || `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHead title="Users" sub={superAdmin ? "Suspend accounts and manage roles." : "Suspend or reactivate accounts. Only a super admin can change roles."} />
      <input type="search" aria-label="Search users" className="field mb-4 !w-80 max-w-full" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
      {error ? <p className="text-rose">{error}</p> : null}
      {data ? (
        <DataTable head={["User", "Roles", "Status", "Joined", ""]} min={820}>
          {shown.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-3"><span className="flex items-center gap-3"><Avatar name={u.name} size={32} /><span><span className="block font-bold">{u.name}</span><span className="text-xs text-muted">{u.email}</span></span></span></td>
              <td className="px-4 py-3">
                {superAdmin && u.id !== me?.id ? (
                  <span className="flex flex-wrap gap-1.5">
                    {ROLES.map((r) => (
                      <label key={r} className={`chip cursor-pointer ${u.roles.includes(r) ? "!bg-violet-soft !text-violet" : ""}`}>
                        <input type="checkbox" className="sr-only" checked={u.roles.includes(r)} onChange={(e) => update(u, { roles: e.target.checked ? [...u.roles, r] : u.roles.filter((x) => x !== r) })} />
                        {r.replace("_", " ")}
                      </label>
                    ))}
                  </span>
                ) : <span className="flex flex-wrap gap-1.5">{u.roles.map((r) => <span key={r} className="chip">{r.replace("_", " ")}</span>)}</span>}
              </td>
              <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
              <td className="whitespace-nowrap px-4 py-3 text-ink-2">{date(u.createdAt)}</td>
              <td className="px-4 py-3 text-right">
                {u.id !== me?.id && has("admin") ? (
                  <button type="button" className={`btn btn-sm ${u.status === "active" ? "btn-ghost text-rose" : "btn-outline"}`} onClick={() => update(u, { status: u.status === "active" ? "suspended" : "active" })}>
                    {u.status === "active" ? "Suspend" : "Reactivate"}
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </DataTable>
      ) : !error ? <Skeleton className="h-80" /> : null}
    </>
  );
}
