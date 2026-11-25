"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { list, toCategory } from "@/lib/normalize";
import { PageHead } from "@/components/shell/AppShell";
import { Skeleton } from "@/components/Empty";
import { useToast } from "@/components/Toast";
import { categoryIcon } from "@/components/CategoryIcon";

const map = (r: unknown) => list(r, "categories").map(toCategory);
const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function AdminCategories() {
  const toast = useToast();
  const { data, error, reload } = useApi("/admin/categories", map);
  const [name, setName] = useState("");
  async function run(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); toast("ok", ok); reload(); } catch (e) { toast("error", errMsg(e)); }
  }
  return (
    <>
      <PageHead title="Categories" sub="Topics learners browse by. Renaming keeps the link; deleting is only possible when no course uses the category." />
      {error ? <p className="text-rose">{error}</p> : null}
      {!data && !error ? <Skeleton className="h-80 max-w-3xl" /> : null}
      {data ? (
        <div className="max-w-3xl">
          <ul className="divide-y divide-line rounded-panel border border-line bg-surface">
            {data.map((c) => {
              const I = categoryIcon(c.slug, c.icon);
              return (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <I className="size-5 shrink-0 text-violet" />
                  <input aria-label={`Name of ${c.name}`} defaultValue={c.name} className="field !min-h-9 !py-1 font-bold"
                    onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && run(() => api(`/admin/categories/${c.id}`, { method: "PATCH", body: { name: e.target.value.trim() } }), "Category renamed.")} />
                  <span className="hidden w-48 truncate text-xs text-muted sm:block">/{c.slug}</span>
                  <button type="button" className="btn btn-ghost btn-sm !px-2 text-rose" aria-label={`Delete ${c.name}`} onClick={() => confirm(`Delete category “${c.name}”?`) && run(() => api(`/admin/categories/${c.id}`, { method: "DELETE" }), "Category deleted.")}><Trash2 className="size-4" /></button>
                </li>
              );
            })}
          </ul>
          <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) void run(() => api("/admin/categories", { method: "POST", body: { name: name.trim(), slug: slugify(name), sort: data.length + 1 } }), "Category added.").then(() => setName("")); }}>
            <input aria-label="New category name" className="field" placeholder="New category, e.g. Observability" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn btn-primary"><Plus className="size-4" />Add</button>
          </form>
        </div>
      ) : null}
    </>
  );
}
