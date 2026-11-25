"use client";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/config";
import { api } from "@/lib/api";
import { obj } from "@/lib/normalize";

export function safeNext(n: string | null | undefined): string {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/my-learning";
}

export interface Provider { key: string; label: string }
export interface Policy { minLength: number; rules: string[] }

/** Enabled sign-in providers and the password rules (the API decides which buttons exist: no keys, no button). */
export function useProviders() {
  const [data, setData] = useState<{ items: Provider[]; policy: Policy } | null>(null);
  useEffect(() => {
    api("/auth/providers").then((r) => {
      const o = obj(r); const p = obj(o.passwordPolicy);
      setData({ items: (Array.isArray(o.items) ? o.items : []).map((x) => ({ key: String(obj(x).key), label: String(obj(x).label) })), policy: { minLength: Number(p.minLength ?? 12), rules: Array.isArray(p.rules) ? p.rules.map(String) : [] } });
    }).catch(() => setData({ items: [], policy: { minLength: 12, rules: [] } }));
  }, []);
  return data;
}

export const startUrl = (key: string, mode: "login" | "link", next = "/my-learning") => `${API_URL}/auth/oauth/${key}/start?mode=${mode}&next=${encodeURIComponent(next)}`;

/** Messages for ?error= after a provider round trip. */
export const OAUTH_ERRORS: Record<string, string> = {
  oauth_cancelled: "Sign-in was cancelled. Choose a way to continue.",
  oauth_failed: "We couldn’t complete sign-in with that provider. Please try again.",
  oauth_expired: "That sign-in took too long. Please try again.",
  oauth_no_email: "That account didn’t share an email address with us. Use another way to sign in.",
  oauth_email_unverified: "That account’s email address isn’t verified yet. Verify it with the provider, or use another way to sign in.",
  email_exists: "An account with this email already exists. Log in with your password (or the way you signed up), then link this provider from Account › Security.",
  identity_in_use: "That account is already linked to a different DevOps Easy Learning account.",
  account_locked: "Too many attempts. Try again in a few minutes, or reset your password.",
  account_suspended: "This account is suspended.",
};

/** Provider marks, drawn inline (no third-party scripts or images on the sign-in page). */
export function ProviderIcon({ k, className = "size-5" }: { k: string; className?: string }) {
  if (k === "google") return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.27v3.11A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4-3.11z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.61l4 3.11C6.22 6.88 8.87 4.77 12 4.77z" />
    </svg>
  );
  if (k === "github") return <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path fill="currentColor" d="M12 .5a12 12 0 0 0-3.8 23.39c.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.6-4.04-1.6-.55-1.4-1.34-1.77-1.34-1.77-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.6-2.67-.31-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.31-.54-1.53.11-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.87.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .5z" /></svg>;
  if (k === "facebook") return <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" /><path fill="#fff" d="M16.67 15.56l.53-3.49h-3.33V9.82c0-.96.47-1.89 1.96-1.89h1.51V4.96s-1.37-.24-2.68-.24c-2.74 0-4.53 1.67-4.53 4.69v2.66H7.08v3.49h3.05V24a12.1 12.1 0 0 0 3.74 0v-8.44h2.8z" /></svg>;
  if (k === "linkedin") return <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><rect width="24" height="24" rx="4" fill="#0A66C2" /><path fill="#fff" d="M7.1 9.5H4.6V19h2.5V9.5zM5.85 5.5a1.45 1.45 0 1 0 0 2.9 1.45 1.45 0 0 0 0-2.9zM19.4 13.6c0-2.6-1.4-4.3-3.7-4.3-1.3 0-2.2.7-2.6 1.4V9.5h-2.4V19h2.5v-4.9c0-1.3.5-2.2 1.7-2.2s1.6.9 1.6 2.3V19h2.5l.4-5.4z" /></svg>;
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M8 12h8M12 8v8" /></svg>;
}

/** "Continue with …" buttons; plain links, because the browser leaves for the provider. */
export function SocialButtons({ items, next, verb = "Continue" }: { items: Provider[]; next: string; verb?: string }) {
  if (!items.length) return null;
  return (
    <div className={`grid gap-2.5 ${items.length > 2 ? "grid-cols-2" : items.length > 1 ? "sm:grid-cols-2" : ""}`} data-testid="social-buttons">
      {items.map((p) => (
        <a key={p.key} href={startUrl(p.key, "login", next)} className="btn btn-outline w-full justify-center gap-2.5" data-testid={`social-${p.key}`}>
          <ProviderIcon k={p.key} />{items.length > 2 ? p.label : `${verb} with ${p.label}`}
        </a>
      ))}
    </div>
  );
}

export function Divider({ label }: { label: string }) {
  return (
    <div className="my-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.12em] text-muted">
      <span className="h-px flex-1 bg-line" aria-hidden="true" />{label}<span className="h-px flex-1 bg-line" aria-hidden="true" />
    </div>
  );
}
