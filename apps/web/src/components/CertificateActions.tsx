"use client";
import { Download, FileImage, Printer } from "lucide-react";
import { API_URL } from "@/lib/config";
import { CertificateShare } from "./CertificateShare";

/** Everything a learner does with a certificate, kept outside the certificate itself (owner 2026-11-27). */
export function CertificateActions({ code, url, linkedInUrl, valid }: { code: string; url?: string; linkedInUrl?: string; valid: boolean }) {
  const file = (ext: "pdf" | "png", paper: "letter" | "a4" = "letter") => `${API_URL}/certificates/${encodeURIComponent(code)}/certificate.${ext}${paper === "a4" ? "?paper=a4" : ""}`;
  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="cert-actions">
      {valid && url ? <CertificateShare url={url} linkedInUrl={linkedInUrl} /> : null}
      <a className="btn btn-outline" href={file("pdf")} data-testid="cert-pdf"><Download className="size-4" />PDF (US Letter)</a>
      <a className="btn btn-outline" href={file("pdf", "a4")} data-testid="cert-pdf-a4"><Download className="size-4" />PDF (A4)</a>
      <a className="btn btn-outline" href={file("png")} data-testid="cert-png"><FileImage className="size-4" />PNG image</a>
      <a className="btn btn-ghost" href={`/print/certificates/${encodeURIComponent(code)}`} target="_blank" rel="noopener" data-testid="cert-print"><Printer className="size-4" />Print</a>
    </div>
  );
}
