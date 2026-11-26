"use client";
import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { SOCIAL } from "@/components/SocialLinks";

const LINKEDIN_PATH = SOCIAL.find((s) => s.key === "linkedin")?.path ?? "";

/** Certificate page actions: add to LinkedIn (LinkedIn's own form, the learner confirms there) and copy the public link. */
export function CertificateShare({ url, linkedInUrl }: { url: string; linkedInUrl?: string }) {
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied("yes"); } catch { setCopied("no"); }
    window.setTimeout(() => setCopied(null), 4000);
  }
  return (
    <>
      {linkedInUrl ? (
        <a href={linkedInUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" data-testid="cert-linkedin">
          <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true"><path d={LINKEDIN_PATH} /></svg>Add to LinkedIn
        </a>
      ) : null}
      <button type="button" className="btn btn-outline" onClick={() => void copy()} data-testid="cert-copy">
        {copied === "yes" ? <Check className="size-4" /> : <Link2 className="size-4" />}{copied === "yes" ? "Link copied" : "Copy link"}
      </button>
      {copied === "no" ? <p className="basis-full text-sm text-ink-2" role="status">Copy this link: <span className="break-all font-bold text-ink">{url}</span></p> : null}
      <span className="sr-only" role="status">{copied === "yes" ? "Certificate link copied" : ""}</span>
    </>
  );
}
