"use client";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { AppShell } from "@/components/shell/AppShell";
import { adminNav } from "@/lib/studio-nav";
import { canDo } from "@/lib/studios";
import { useAuth } from "@/components/AuthProvider";
import { Skeleton } from "@/components/Empty";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { me, loading, has } = useAuth();
  const isAdmin = has("admin");
  // Badge on Money: refund requests and open disputes that need a person.
  const count = (r: unknown) => (Array.isArray(obj(r).items) ? (obj(r).items as unknown[]) : []);
  const contact = useApi(canDo(me, "support.manage") ? "/admin/contact?status=new&pageSize=1" : null, (r) => Number(obj(r).newCount ?? 0));
  const requests = useApi(canDo(me, "finance.view") ? "/admin/refund-requests?status=needs_action" : null, (r) => Number(obj(obj(r).counts).needs_action ?? 0));
  const disputes = useApi(canDo(me, "finance.view") ? "/admin/disputes" : null, (r) => count(r).filter((d) => obj(d).status === "open").length);
  const attention = disputes.data ?? 0;
  // Badge on Support: requests waiting for staff.
  const manual = useApi(canDo(me, "enrollments.manage") ? "/enrollments/manual?status=open&pageSize=1" : null, (r) => { const c = obj(obj(r).counts); return Number(c.pending ?? 0) + Number(c.needs_info ?? 0); });
  const reported = useApi(canDo(me, "reviews.moderate") ? "/admin/reviews?reported=true&pageSize=1" : null, (r) => Number(obj(obj(r).counts).openReports ?? 0));
  const support = useApi(canDo(me, "support.manage") ? "/admin/support/summary" : null, (r) => Number(obj(r).awaitingStaff ?? 0));
  if (loading) return <div className="p-10"><Skeleton className="h-96" /></div>;
  if (!has("admin")) {
    return (
      <main id="main" className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <h1 className="font-display text-2xl font-bold">Admins only</h1>
          <p className="mt-2 text-ink-2">Your account doesn’t have access to the admin console.</p>
          <Link href="/" className="btn btn-primary mt-6">Go to the home page</Link>
        </div>
      </main>
    );
  }
  const badge: Record<string, number | undefined> = { "/admin/finance": attention || undefined, "/admin/refunds": requests.data || undefined, "/admin/support": support.data || undefined, "/admin/contact": contact.data || undefined, "/admin/enrollments": manual.data || undefined, "/admin/course-reviews": reported.data || undefined };
  const nav = adminNav(me).map((g) => ({ ...g, items: g.items.map((n) => ({ ...n, badge: badge[n.href] })) }));
  return <AppShell studio="admin" nav={nav}>{children}</AppShell>;
}
