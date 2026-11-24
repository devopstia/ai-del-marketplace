"use client";
import Link from "next/link";
import { BookOpen, ClipboardCheck, FolderTree, Gauge, GraduationCap, Receipt, ScrollText, Settings, Users } from "lucide-react";
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
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { loading, has } = useAuth();
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
  return <AppShell area="Admin console" nav={nav} footer={<ConsoleSwitch to="del" />}>{children}</AppShell>;
}
