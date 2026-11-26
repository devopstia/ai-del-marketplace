"use client";
import Link from "next/link";
import { BookOpen, ClipboardCheck, FolderTree, Gauge, GraduationCap, Landmark, Receipt, ScrollText, Settings, Users, Tag, Image as ImageIcon, LifeBuoy, ShieldCheck, MonitorPlay, RotateCcw, Mail, Clapperboard, UserPlus, MessageSquareText, CreditCard, KeyRound } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { AppShell, type NavItem } from "@/components/shell/AppShell";
import { canDo } from "@/lib/studios";
import { useAuth } from "@/components/AuthProvider";
import { Skeleton } from "@/components/Empty";

type Item = NavItem & { perm?: string; superOnly?: boolean };
const groups: { label?: string; items: Item[] }[] = [
  { items: [{ href: "/admin", label: "Overview", icon: Gauge, exact: true }] },
  { label: "Marketplace", items: [
    { href: "/admin/review", label: "Review queue", icon: ClipboardCheck, perm: "courses.review" },
    { href: "/admin/courses", label: "Courses", icon: BookOpen, perm: "courses.review" },
    { href: "/admin/course-reviews", label: "Course reviews", icon: MessageSquareText, perm: "reviews.moderate" },
  ] },
  { label: "People", items: [
    { href: "/admin/users", label: "Users and roles", icon: Users, perm: "users.view" },
    { href: "/admin/sign-in", label: "Sign-in methods", icon: KeyRound, superOnly: true },
    { href: "/admin/instructors", label: "Instructor applications", icon: GraduationCap, perm: "users.view" },
    { href: "/admin/enrollments", label: "Manual enrollments", icon: UserPlus, perm: "enrollments.manage" },
  ] },
  { label: "Money", items: [
    { href: "/admin/orders", label: "Orders", icon: Receipt, perm: "orders.view" },
    { href: "/admin/finance", label: "Money", icon: Landmark, perm: "finance.view" },
    { href: "/admin/refunds", label: "Refunds", icon: RotateCcw, perm: "finance.view" },
    { href: "/admin/promotions", label: "Promotions", icon: Tag, perm: "promotions.view" },
  ] },
  { label: "Support", items: [
    { href: "/admin/support", label: "Support requests", icon: LifeBuoy, perm: "support.manage" },
    { href: "/admin/contact", label: "Contact messages", icon: Mail, perm: "support.manage" },
    { href: "/admin/help", label: "Manage platform videos", icon: Clapperboard, perm: "content.manage" },
    { href: "/help", label: "Platform videos", icon: MonitorPlay, testId: "nav-platform-videos" },
  ] },
  { label: "Platform", items: [
    { href: "/admin/categories", label: "Categories", icon: FolderTree, perm: "content.manage" },
    { href: "/admin/covers", label: "Cover templates", icon: ImageIcon, perm: "content.manage" },
    { href: "/admin/protection", label: "Video protection", icon: ShieldCheck, perm: "content.manage" },
    { href: "/admin/payments", label: "Payments & Stripe", icon: CreditCard, superOnly: true },
    { href: "/admin/settings", label: "Settings", icon: Settings, superOnly: true },
    { href: "/admin/audit", label: "Audit log", icon: ScrollText, perm: "audit.view" },
  ] },
];

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
  const nav = groups
    .map((g) => ({ label: g.label, items: g.items.filter((n) => (n.superOnly ? has("super_admin") : !n.perm || canDo(me, n.perm))).map(({ perm: _p, superOnly: _s, ...n }) => ({ ...n, badge: badge[n.href] })) }))
    .filter((g) => g.items.length);
  return <AppShell studio="admin" nav={nav}>{children}</AppShell>;
}
