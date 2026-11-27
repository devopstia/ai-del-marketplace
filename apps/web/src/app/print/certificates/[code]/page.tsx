import type { Metadata } from "next";
import { API_URL } from "@/lib/config";
import { AutoPrint } from "./AutoPrint";

export const metadata: Metadata = { title: "Print certificate", robots: { index: false, follow: false } };

/**
 * Only the certificate, nothing from the site (owner 2026-11-27): the same server-rendered drawing as the PDF, one
 * landscape page with no margins. ?paper=a4 for A4; the print dialog opens by itself.
 */
export default async function PrintCertificate({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ paper?: string }> }) {
  const { code } = await params;
  const paper = (await searchParams).paper === "a4" ? "a4" : "letter";
  const src = `${API_URL}/certificates/${encodeURIComponent(code)}/certificate.svg${paper === "a4" ? "?paper=a4" : ""}`;
  return (
    <>
      <style>{`@page{size:${paper === "a4" ? "A4" : "letter"} landscape;margin:0}html,body{margin:0;padding:0;background:#fbf8f1}body{padding:0!important}.cert-print{display:flex;align-items:center;justify-content:center;width:100vw;height:100vh}.cert-print img{width:100%;height:100%;object-fit:contain}@media print{body *{visibility:hidden}.cert-print,.cert-print *{visibility:visible}.cert-print{position:fixed;inset:0}}`}</style>
      <main className="cert-print">
        {/* eslint-disable-next-line @next/next/no-img-element -- an SVG drawn by the API at print size */}
        <img id="cert" src={src} alt={`Certificate ${code}`} />
      </main>
      <AutoPrint />
    </>
  );
}
