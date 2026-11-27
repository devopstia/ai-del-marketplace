"use client";
import { useState, useSyncExternalStore } from "react";
import { Check, Link2, Mail, MessageCircle, Send, Share2 } from "lucide-react";
import { SOCIAL } from "@/components/SocialLinks";

const noop = () => () => {};
const brand = (key: string) => SOCIAL.find((s) => s.key === key)?.path ?? "";

/** The share message (owner 2026-11-28): "<Course title>, on DevOps Easy Learning: <url>". */
export function shareMessage(title: string, url: string) {
  return `${title}, on DevOps Easy Learning: ${url}`;
}

/** Each app's own share address. Plain links: no scripts, trackers or cookies from the platforms load on our pages. */
export function shareLinks(title: string, url: string) {
  const u = encodeURIComponent(url);
  const msg = shareMessage(title, url);
  return [
    { key: "whatsapp", label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(msg)}` },
    { key: "facebook", label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { key: "linkedin", label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { key: "telegram", label: "Telegram", href: `https://t.me/share/url?url=${u}&text=${encodeURIComponent(`${title}, on DevOps Easy Learning`)}` },
    { key: "x", label: "X", href: `https://x.com/intent/tweet?url=${u}&text=${encodeURIComponent(`${title}, on DevOps Easy Learning`)}` },
    { key: "email", label: "Email", href: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(msg)}` },
  ];
}

function Icon({ k }: { k: string }) {
  if (k === "whatsapp") return <MessageCircle className="size-[18px]" aria-hidden="true" />;
  if (k === "telegram") return <Send className="size-[17px]" aria-hidden="true" />;
  if (k === "email") return <Mail className="size-[18px]" aria-hidden="true" />;
  return <svg viewBox="0 0 24 24" className="size-[17px]" fill="currentColor" aria-hidden="true"><path d={brand(k)} /></svg>;
}

/**
 * Share a public page (docs/SOCIAL_SHARING.md): WhatsApp, Facebook, LinkedIn, Telegram, X, email, the device's own share
 * sheet (only where the browser has one) and Copy link. Always the canonical address. `tone="stage"` sits on the dark
 * course header; `tone="page"` on the normal surfaces in light and dark.
 */
export function ShareButtons({ title, url, tone = "page" }: { title: string; url: string; tone?: "stage" | "page" }) {
  // The device share sheet exists only in some browsers: decided after hydration (false on the server).
  const canNative = useSyncExternalStore(noop, () => typeof navigator.share === "function", () => false);
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied("yes"); } catch { setCopied("no"); }
    window.setTimeout(() => setCopied(null), 4000);
  }
  async function native() {
    try { await navigator.share({ title, text: `${title}, on DevOps Easy Learning`, url }); } catch { /* closed by the user */ }
  }

  const btn = tone === "stage"
    ? "inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9fd9f5]"
    : "inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface text-ink transition hover:border-violet hover:text-violet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet";
  const label = tone === "stage" ? "text-white/80" : "text-ink-2";

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="share-buttons">
      <span className={`mr-1 text-sm font-bold ${label}`} id="share-label">Share</span>
      <ul className="flex flex-wrap items-center gap-2" aria-labelledby="share-label">
        {shareLinks(title, url).map((l) => (
          <li key={l.key}>
            <a href={l.href} className={btn} target={l.key === "email" ? undefined : "_blank"} rel="noopener noreferrer" aria-label={`Share on ${l.label}`} title={l.label} data-share={l.key}>
              <Icon k={l.key} />
            </a>
          </li>
        ))}
        {canNative ? (
          <li><button type="button" className={btn} onClick={() => void native()} aria-label="More ways to share" title="More ways to share" data-share="native"><Share2 className="size-[18px]" aria-hidden="true" /></button></li>
        ) : null}
        <li>
          <button type="button" className={`${btn} w-auto gap-1.5 px-3.5 text-sm font-bold`} onClick={() => void copy()} data-share="copy">
            {copied === "yes" ? <Check className="size-4" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}{copied === "yes" ? "Copied" : "Copy link"}
          </button>
        </li>
      </ul>
      {copied === "no" ? <p className={`basis-full text-sm ${label}`} role="status">Copy this link: <span className="break-all font-bold">{url}</span></p> : null}
      <span className="sr-only" role="status">{copied === "yes" ? "Link copied" : ""}</span>
    </div>
  );
}
