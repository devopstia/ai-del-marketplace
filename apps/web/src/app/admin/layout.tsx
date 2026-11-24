"use client";
import Link from "next/link";
import { BookOpen, ClipboardCheck, FolderTree, Gauge, GraduationCap, Landmark, Receipt, ScrollText, Settings, Users } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { AppShell } from "@/components/shell/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { Skeleton } from "@/components/Empty";
import { ConsoleSwitch } from "@/components/shell/ConsoleSwitch";

const nav = [
  { href: "/admin", label: "Overview", icon: Gauge, exact: true },
  { href: "/admin/review", label: "Review queue", icon: ClipboardCheck },
  { href: "/admin/courses", label: "Courses", icon: BookOpen },
  { href: "/admin/instructors", label: "Instructors", icon: GraduationCap },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/orders", label: "Orders", icon: Receipt },
  { href: "/admin/finance", label: "Money", icon: Landmark },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { loading, has } = useAuth();
  const isAdmin = has("admin");
  // Badge on Money: refund requests and open disputes that need a person.
  const count = (r: unknown) => (Array.isArray(obj(r).items) ? (obj(r).items as unknown[]) : []);
  const requests = useApi(isAdmin ? "/admin/refund-requests?status=pending" : null, (r) => count(r).length);
  const disputes = useApi(isAdmin ? "/admin/disputes" : null, (r) => count(r).filter((d) => obj(d).status === "open").length);
  const attention = (requests.data ?? 0) + (disputes.data ?? 0);
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
  const items = nav.map((n) => (n.href === "/admin/finance" && attention ? { ...n, badge: attention } : n));
  return <AppShell area="Admin console" nav={items} footer={<ConsoleSwitch to="del" />}>{children}</AppShell>;
}
