import type { LucideIcon } from "lucide-react";
import { BookOpenCheck, Building2, Clapperboard, ShieldCheck } from "lucide-react";
import type { Me } from "./types";

/**
 * The studios one account can open (owner 2026-11-25): one login, several roles, never separate accounts.
 * Switching studios changes only the view; the API checks every action against the account's real roles.
 */
export type StudioKey = "student" | "instructor" | "del" | "admin";
export interface Studio { key: StudioKey; label: string; href: string; icon: LucideIcon; hint: string }

export function studiosFor(me: Me | null): Studio[] {
  if (!me) return [];
  const roles = me.roles;
  const out: Studio[] = [{ key: "student", label: "Student Studio", href: "/student", icon: BookOpenCheck, hint: "Your courses and progress" }];
  if (roles.includes("instructor") && me.instructorStatus !== "pending") out.push({ key: "instructor", label: "Instructor Studio", href: "/studio", icon: Clapperboard, hint: "Your courses, students and earnings" });
  if (roles.includes("super_admin")) out.push({ key: "del", label: "DEL Studio", href: "/studio", icon: Building2, hint: "DEL’s own courses, as DevOps Easy Learning" });
  if (roles.includes("admin") || roles.includes("super_admin")) {
    const sup = roles.includes("super_admin");
    out.push({ key: "admin", label: sup ? "Super Admin Studio" : "Admin Studio", href: "/admin", icon: ShieldCheck, hint: sup ? "The whole marketplace" : "Marketplace operations" });
  }
  return out;
}

/** Admin permission check for menus (the API enforces it again on every request). */
export function canDo(me: Me | null, perm: string) {
  if (!me) return false;
  if (me.roles.includes("super_admin")) return true;
  return me.roles.includes("admin") && !!me.adminPermissions?.includes(perm);
}
