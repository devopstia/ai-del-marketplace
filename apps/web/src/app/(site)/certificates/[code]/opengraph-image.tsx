import { ImageResponse } from "next/og";
import { SERVER_API_URL } from "@/lib/config";
import { toCertificate } from "@/lib/normalize";

/** The preview card a shared certificate link shows (LinkedIn, WhatsApp, X): learner, course, DEL, issue month. */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "DevOps Easy Learning certificate of completion";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let cert = null;
  try {
    const res = await fetch(`${SERVER_API_URL}/certificates/${encodeURIComponent(code)}`, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (res.ok) cert = toCertificate(await res.json());
  } catch { /* falls back to the generic card */ }
  const issued = cert ? new Date(cert.issuedAt).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) : "";
  const title = cert?.course.title ?? "Certificate verification";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0c0f22", color: "#e8eaf7", padding: "64px 72px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 54, height: 54, borderRadius: 14, background: "#9d8fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#0c0f22", fontSize: 26, fontWeight: 800 }}>DEL</div>
          <div style={{ fontSize: 30, fontWeight: 700 }}>DevOps Easy Learning</div>
          <div style={{ marginLeft: "auto", display: "flex", fontSize: 24, fontWeight: 700, color: "#3fcf92" }}>{cert ? "✓ Verified certificate" : ""}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 28, color: "#9ea3c4" }}>{cert ? "Certificate of completion" : ""}</div>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, marginTop: 10 }}>{cert ? cert.user.name : "Check a DEL certificate"}</div>
          <div style={{ fontSize: 40, fontWeight: 700, color: "#9d8fff", marginTop: 24, lineHeight: 1.15 }}>{title.length > 80 ? `${title.slice(0, 78)}…` : title}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#c9cce3", borderTop: "2px solid #262c52", paddingTop: 24 }}>
          <div style={{ display: "flex" }}>{cert ? `Issued ${issued}` : ""}</div>
          <div style={{ display: "flex" }}>{cert ? cert.code : ""}</div>
        </div>
      </div>
    ),
    size,
  );
}
