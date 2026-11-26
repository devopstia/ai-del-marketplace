import { ImageResponse } from "next/og";

// Default link preview (WhatsApp, LinkedIn, Facebook, X) for pages without their own image. Course pages use their
// generated cover instead (docs/SEO.md). Colours: the site's dark tokens (globals.css).
export const alt = "DevOps Easy Learning: AI and DevOps courses";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0c0f22", color: "#e8eaf7", padding: "72px 80px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "#9d8fff", color: "#0c0f22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 800 }}>DEL</div>
          <div style={{ fontSize: 32, fontWeight: 700 }}>DevOps Easy Learning</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.02em", maxWidth: 980 }}>AI and DevOps courses taught by working engineers</div>
          <div style={{ fontSize: 30, color: "#c9cce3" }}>Certificates anyone can verify · 12 months of access per course</div>
        </div>
        <div style={{ display: "flex", height: 10, width: 220, borderRadius: 5, background: "#3fcf92" }} />
      </div>
    ),
    size,
  );
}
