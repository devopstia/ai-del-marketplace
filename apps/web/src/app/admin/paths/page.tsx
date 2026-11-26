"use client";
import Link from "next/link";
import { Plus, Route } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { list, obj } from "@/lib/normalize";
import { date, plural } from "@/lib/format";
import { DataTable, PageHead } from "@/components/shell/AppShell";
import { Empty, Skeleton } from "@/components/Empty";
import { useAuth } from "@/components/AuthProvider";

interface Row { id: string; slug: string; title: string; summary: string; status: string; updatedAt: string; stepCount: number; followerCount: number }
const map = (r: unknown): Row[] => list(obj(r).items).map((x) => {
  const o = obj(x);
  return { id: String(o.id), slug: String(o.slug ?? ""), title: String(o.title ?? ""), summary: String(o.summary ?? ""), status: String(o.status ?? "draft"), updatedAt: String(o.updatedAt ?? ""), stepCount: Number(o.stepCount ?? 0), followerCount: Number(o.followerCount ?? 0) };
});

/** Admin › Marketplace › Career paths (docs/CAREER_PATHS.md). Admins with content.manage look; super admins edit. */
export default function AdminPaths() {
  const { me } = useAuth();
  const sup = !!me?.roles.includes("super_admin");
  const { data, error } = useApi("/admin/paths", map);
  return (
    <>
      <PageHead
        title="Career paths"
        sub="Courses in order for a role, with the skills each gives. Students follow a path for a weekly plan; each course is still bought on its own."
        actions={sup ? <Link href="/admin/paths/new" className="btn btn-primary" data-testid="new-path"><Plus className="size-4" aria-hidden="true" />New path</Link> : null}
      />
      {error ? <p className="text-rose">{error}</p> : null}
      {!data && !error ? <Skeleton className="h-64" /> : null}
      {data && !data.length ? (
        <Empty icon={Route} title="No career paths yet" body={sup ? "Create a path from published courses. It stays a draft until you publish it." : "A super admin creates career paths."} href={sup ? "/admin/paths/new" : undefined} cta={sup ? "New path" : undefined} />
      ) : null}
      {data?.length ? (
        <DataTable head={["Path", "Status", "Courses", "Followers", "Updated"]} min={680}>
          {data.map((p) => (
            <tr key={p.id} data-testid="admin-path-row">
              <td className="px-4 py-3.5"><Link href={`/admin/paths/${p.id}`} className="font-bold hover:text-violet">{p.title}</Link><p className="text-xs text-muted">/paths/{p.slug}</p></td>
              <td className="px-4 py-3.5">{p.status === "published" ? <span className="rounded-full bg-mint-soft px-2 py-0.5 text-xs font-bold text-mint">Published</span> : <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-ink-2">Draft</span>}</td>
              <td className="px-4 py-3.5 tabular-nums">{plural(p.stepCount, "course")}</td>
              <td className="px-4 py-3.5 tabular-nums">{p.followerCount}</td>
              <td className="px-4 py-3.5 text-ink-2">{date(p.updatedAt)}</td>
            </tr>
          ))}
        </DataTable>
      ) : null}
    </>
  );
}
