// Generic slide system (ported from the Insurance Knowledge Hub, 2026-11-25; dark tokens for DEL): 1536x864 HTML slides in the brand's colours. Elements
// with data-r="n" appear when narration line n starts (window.reveal(n));
// reveal(99) shows the final state (decks, thumbnails).
import fs from "node:fs";

export const ICONS = {
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M8 7h8M8 11h6"/>',
  exam: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  grad: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 0 1 5.5 5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', video: '<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  life: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m5.6 5.6 3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6"/>',
  check: '<path d="m5 12 5 5 9-10"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
  shield: '<path d="M12 3 4 6.5v5.6c0 4.6 3.2 8.4 8 9.9 4.8-1.5 8-5.3 8-9.9V6.5Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>', key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M14 9l2 2"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  paper: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>', route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h6a4 4 0 0 0 0-8h-4a4 4 0 0 1 0-8h6"/>',
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9Z"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  bulb: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>', laptop: '<rect x="4" y="5" width="16" height="11" rx="1"/><path d="M2 19h20"/>',
  finger: '<path d="M12 11v4M8 9a4 4 0 0 1 8 0v5a6 6 0 0 1-1 3M5 11a7 7 0 0 1 14-2M8 13v2a8 8 0 0 0 1.5 4.5M16 13v1"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2.5"/><path d="M13 10h6M13 14h4"/>', qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM18 18h3v3h-3z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', headphones: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><rect x="2" y="16" width="5" height="6" rx="1"/><rect x="17" y="16" width="5" height="6" rx="1"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>', bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>', share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/>', flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
};

export function makeSlides(brand) {
  const C = brand.colors;
  const LOGO = brand.logoSvg();
  const LOGO_INV = brand.logoSvg();
  const I = (n, c = "currentColor", s = 26, w = 1.9) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ICONS.info}</svg>`;
  const img = (file) => `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
  const win = (file, style = "") => `<div class="win" style="${style}"><div class="wbar"><i></i><i></i><i></i><span>${brand.url}</span></div><img src="${img(file)}"></div>`;
  const CSS = `
${brand.fontCss()}
*{box-sizing:border-box;margin:0;padding:0}html,body{width:1536px;height:864px;overflow:hidden}
body{font-family:${brand.fontBody};color:${C.ink};background:${C.bg};position:relative;-webkit-font-smoothing:antialiased}
.bg{position:absolute;inset:0;overflow:hidden}
.bg:before{content:"";position:absolute;width:1100px;height:1100px;right:-380px;top:-560px;border-radius:50%;background:radial-gradient(closest-side,${C.primary}26,${C.primary}00)}
.bg:after{content:"";position:absolute;width:900px;height:900px;left:-420px;bottom:-520px;border-radius:50%;background:radial-gradient(closest-side,${C.teal}1a,${C.teal}00)}
.grid{position:absolute;inset:0;background-image:linear-gradient(${C.primary}0b 1px,transparent 1px),linear-gradient(90deg,${C.primary}0b 1px,transparent 1px);background-size:48px 48px;mask-image:radial-gradient(ellipse at 70% 30%,#000 10%,transparent 70%)}
.top{position:absolute;left:72px;right:72px;top:40px;display:flex;align-items:center;justify-content:space-between;z-index:3}
.brand{display:flex;align-items:center;gap:12px}.brand .lg{width:56px;height:28px}
.brand b{font-family:${brand.fontDisplay};font-size:18px;font-weight:700}.brand i{display:block;font-style:normal;font-size:10.5px;font-weight:700;letter-spacing:.22em;color:${C.primary};margin-top:1px}
.chap{display:flex;align-items:center;gap:12px;font-size:13.5px;font-weight:650;color:${C.muted};letter-spacing:.06em;text-transform:uppercase}
.chap em{font-style:normal;color:${C.primary};background:${C.primarySoft};border:1px solid ${C.lineStrong};border-radius:999px;padding:5px 11px;letter-spacing:.08em}
.wrap{position:absolute;left:96px;right:96px;top:128px;bottom:72px}
.eyebrow{font-size:15px;font-weight:750;letter-spacing:.2em;text-transform:uppercase;color:${C.primary};display:flex;align-items:center;gap:10px}
.eyebrow:before{content:"";width:28px;height:3px;border-radius:3px;background:${C.primary}}
h1{font-family:${brand.fontDisplay};font-size:64px;line-height:1.06;font-weight:800;letter-spacing:-.032em;margin-top:16px}
h1 .hl{background:linear-gradient(90deg,${C.primary},${C.primary2});-webkit-background-clip:text;background-clip:text;color:transparent}
h2{font-family:${brand.fontDisplay};font-size:25px;font-weight:700;letter-spacing:-.015em}p{font-size:20.5px;line-height:1.5;color:${C.body}}
.lead{font-size:23px;line-height:1.5;color:${C.body};margin-top:18px;max-width:980px}
.card{background:${C.surface};border:1px solid ${C.line};border-radius:20px;box-shadow:0 18px 40px rgba(0,0,0,.28);padding:30px}
.ic{width:60px;height:60px;border-radius:16px;background:${C.primarySoft};color:${C.primary};display:grid;place-items:center;flex:none;border:1px solid ${C.lineStrong}}
.win{border-radius:16px;overflow:hidden;background:${C.surface};box-shadow:0 30px 70px rgba(0,0,0,.45);border:1px solid ${C.lineStrong}}
.wbar{height:30px;display:flex;align-items:center;gap:7px;padding:0 14px;background:${C.surface2};border-bottom:1px solid ${C.line}}
.wbar i{width:10px;height:10px;border-radius:50%;background:${C.lineStrong}}.wbar span{margin-left:14px;font-size:11.5px;color:${C.muted};background:${C.bg};border-radius:7px;padding:3px 12px}
.win img{display:block;width:100%}
.pill{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:8px 15px;font-weight:650;font-size:15px}
[data-r]{opacity:0;transform:translateY(22px);transition:opacity .8s ease,transform .9s cubic-bezier(.2,.8,.2,1)}[data-r].on{opacity:1;transform:none}
[data-r].right{transform:translateX(60px)}[data-r].right.on{transform:none}
.foot{position:absolute;left:96px;right:96px;bottom:34px;font-size:13px;color:${C.muted};line-height:1.5}`;
  const SCRIPT = `<script>window.reveal=(n)=>{document.querySelectorAll('[data-r]').forEach(e=>{if(+e.dataset.r<=n)e.classList.add('on')})};</script>`;
  const page = (chapter, num, body, extra = "") => `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}${extra}</style></head><body><div class="bg"><div class="grid"></div></div>
    ${chapter ? `<div class="top"><div class="brand"><span class="lg">${LOGO}</span><span><b>${brand.name}</b><i>${brand.tagline}</i></span></div><div class="chap">${num ? `<em>${num}</em>` : ""}${chapter}</div></div>` : ""}${body}${SCRIPT}</body></html>`;
  const blueBg = `<div style="position:absolute;inset:0;background:linear-gradient(135deg,${C.surface2} 0%,${C.bg} 70%)"></div>
    <div style="position:absolute;inset:0;background:radial-gradient(700px 500px at 85% 15%,${C.primary}33,transparent 60%),radial-gradient(600px 420px at 10% 95%,${C.teal}26,transparent 60%)"></div>
    <div style="position:absolute;inset:0;background-image:linear-gradient(${C.primary}0d 1px,transparent 1px),linear-gradient(90deg,${C.primary}0d 1px,transparent 1px);background-size:48px 48px"></div>`;
  const cardGrid = (items, cols, startR = 1, stagger = 0.3) => `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:24px;margin-top:46px">
    ${items.map(([i, h, t, r], k) => `<div class="card" data-r="${r ?? startR}" style="transition-delay:${k * stagger}s;display:flex;gap:18px;align-items:flex-start;padding:32px;min-height:${cols >= 3 ? 210 : 170}px"><div class="ic" style="width:64px;height:64px">${I(i, "currentColor", 30)}</div><div><h2 style="font-size:25px">${h}</h2><p style="margin-top:10px;font-size:19.5px">${t}</p></div></div>`).join("")}</div>`;

  /** Standard tutorial slides. `t` is the tutorial, `s` the scene. */
  const T = {
    title: (t, s) => page("", "", `
      <div class="wrap" style="top:90px;right:auto;width:${s.shot ? 640 : 1100}px;display:flex;flex-direction:column;justify-content:center;bottom:110px">
        <div data-r="0" style="display:flex;align-items:center;gap:14px"><span style="width:80px;height:40px">${LOGO}</span><span style="font-family:${brand.fontDisplay};font-size:20px;font-weight:700">${brand.name}</span></div>
        <div data-r="0" class="pill" style="margin-top:34px;align-self:flex-start;background:${C.primarySoft};color:${C.primary};border:1px solid ${C.lineStrong};letter-spacing:.12em;font-size:14px">${(brand.academy + " · " + t.categoryName).toUpperCase()}</div>
        <h1 data-r="0" style="font-size:${t.short.length > 26 ? 58 : 66}px;margin-top:22px">${t.short}</h1>
        <p data-r="1" style="margin-top:20px;font-size:23px">${t.subtitle || t.description}</p>
        <div data-r="1" style="margin-top:26px;display:flex;flex-wrap:wrap;gap:10px">${(t.chips || []).map((c) => `<span class="pill" style="background:${C.surface2};border:1px solid ${C.line};color:${C.body}">${c}</span>`).join("")}</div>
      </div>
      ${s.shot ? `<div data-r="0" class="right" style="position:absolute;right:-320px;top:110px;width:1080px">${win(s.shot)}</div>` : ""}`),
    why: (t, s) => page("Introduction", "01", `<div class="wrap"><div class="eyebrow">${s.eyebrow || "Why it matters"}</div><h1>${s.heading}</h1>
      ${s.lead ? `<p class="lead" data-r="0">${s.lead}</p>` : ""}${cardGrid(s.cards, s.cards.length === 4 ? 2 : 3, 1)}</div>`),
    access: (t, s) => page("How to access it", "02", `<div class="wrap"><div class="eyebrow">How to access it</div><h1>${s.heading || "Where to find it"}</h1>
      <div style="margin-top:56px;display:flex;align-items:center;flex-wrap:wrap;gap:18px">
        ${s.path.map((p, k) => `${k ? `<span data-r="0" style="transition-delay:${k * .45 - .2}s;color:${C.muted}">${I("arrow", C.muted, 34)}</span>` : ""}<div data-r="0" class="card" style="transition-delay:${k * .45}s;display:flex;align-items:center;gap:16px;padding:22px 28px;${k === s.path.length - 1 ? `border:2px solid ${C.primary};box-shadow:0 18px 40px ${C.primary}2e` : ""}"><div class="ic" style="width:52px;height:52px">${I(p[0], "currentColor", 26)}</div><div><div style="font-size:13px;font-weight:750;letter-spacing:.14em;color:${C.muted}">${k === 0 ? "START" : `STEP ${k}`}</div><div style="font-size:26px;font-weight:720;margin-top:2px">${p[1]}</div></div></div>`).join("")}
      </div>
      ${s.note ? `<p data-r="1" style="margin-top:46px;font-size:22px;display:flex;align-items:center;gap:12px">${I("info", C.primary, 26)} ${s.note}</p>` : ""}
      ${s.role ? `<div data-r="1" style="margin-top:22px;display:inline-flex;align-items:center;gap:10px" class="pill" ><span style="background:${C.primarySoft};color:${C.primary};border-radius:999px;padding:8px 15px;font-weight:650">${I("user", C.primary, 18)} ${s.role}</span></div>` : ""}</div>`),
    steps: (t, s) => page(s.chapter || "Step by step", s.num || "03", `<div class="wrap"><div class="eyebrow">${s.eyebrow || "Step by step"}</div><h1>${s.heading}</h1>
      <div style="margin-top:54px;display:grid;grid-template-columns:repeat(${s.items.length},1fr);gap:22px">
        ${s.items.map(([i, h, txt], k) => `<div data-r="${s.reveal ? s.reveal[k] : 1}" class="card" style="transition-delay:${s.reveal ? 0 : k * .4}s;min-height:280px"><div style="display:flex;justify-content:space-between;align-items:center"><div class="ic" style="width:66px;height:66px">${I(i, "currentColor", 30)}</div><span style="font-size:52px;font-weight:800;color:${C.lineStrong}">${k + 1}</span></div><h2 style="margin-top:22px;font-size:26px">${h}</h2><p style="margin-top:10px;font-size:19.5px">${txt}</p></div>`).join("")}
      </div></div>`),
    scenario: (t, s) => page("Practical scenario", s.num || "04", `<div class="wrap">
      <div class="eyebrow">Practical scenario</div><h1>${s.heading}</h1>
      <div style="display:grid;grid-template-columns:360px 1fr;gap:30px;margin-top:44px">
        <div class="card" data-r="0" style="padding:34px;text-align:center"><div style="width:110px;height:110px;margin:0 auto;border-radius:50%;background:linear-gradient(135deg,${C.primary},${C.primary2});color:${C.onPrimary};display:grid;place-items:center;font-size:40px;font-weight:780">${s.persona.initials}</div>
          <h2 style="margin-top:20px;font-size:28px">${s.persona.name}</h2><p style="margin-top:6px;font-size:19px">${s.persona.role}</p><div style="margin-top:16px" class="pill"><span style="background:${C.primarySoft};color:${C.primary};border-radius:999px;padding:7px 14px;font-size:14px;font-weight:700">FICTIONAL EXAMPLE</span></div></div>
        <div class="card" data-r="0" style="padding:36px"><div style="display:flex;gap:14px;align-items:center;font-size:15px;font-weight:750;letter-spacing:.14em;color:${C.muted}">${I("target", C.primary, 22)} THE GOAL</div>
          <div style="margin-top:12px;font-size:30px;font-weight:720;line-height:1.3;letter-spacing:-.015em">${s.goal}</div>
          <div style="margin-top:26px;display:grid;gap:14px">${s.plan.map((p, k) => `<div data-r="1" style="transition-delay:${k * .3}s;display:flex;gap:14px;align-items:flex-start;font-size:21px;color:${C.body}"><span style="width:32px;height:32px;flex:none;border-radius:50%;background:${C.primary};color:${C.onPrimary};display:grid;place-items:center;font-size:15px;font-weight:750">${k + 1}</span>${p}</div>`).join("")}</div></div>
      </div></div>`),
    tips: (t, s) => page("Important tips", s.num || "05", `<div class="wrap"><div class="eyebrow">Important tips</div><h1>${s.heading || "Good to know"}</h1>
      ${cardGrid(s.tips.map(([i, h, x], k) => [i, h, x, Math.min(k, (s.lines?.length || 1) - 1)]), s.tips.length === 4 ? 2 : 3, 0, 0)}</div>`),
    summary: (t, s) => page("", "", `${blueBg}
      <div style="position:absolute;left:110px;right:110px;top:90px;color:${C.ink}">
        <div style="display:flex;align-items:center;gap:14px"><span style="width:80px;height:40px">${LOGO_INV}</span><b style="font-family:${brand.fontDisplay};font-size:22px">${brand.name}</b></div>
        <div data-r="0" style="margin-top:40px;font-size:15px;font-weight:750;letter-spacing:.2em;color:${C.primary}">SUMMARY · ${t.short.toUpperCase()}</div>
        <div data-r="0" style="margin-top:12px;font-family:${brand.fontDisplay};font-size:54px;font-weight:800;letter-spacing:-.03em">${s.heading || "What you learned"}</div>
        <div style="margin-top:30px;display:grid;grid-template-columns:1fr 1fr;gap:16px 40px;max-width:1300px">${s.points.map((p, k) => `<div data-r="0" style="transition-delay:${.3 + k * .25}s;display:flex;gap:14px;align-items:flex-start;font-size:23px;line-height:1.35">${I("check", C.good, 28, 2.6)}<span>${p}</span></div>`).join("")}</div>
        ${s.next ? `<div data-r="${Math.max(0, (s.lines?.length || 1) - 1)}" style="margin-top:44px;display:inline-flex;align-items:center;gap:12px;background:${C.primary};color:${C.onPrimary};border-radius:999px;padding:15px 28px;font-size:21px;font-weight:750">Next: ${s.next} ${I("arrow", C.onPrimary, 20, 2.4)}</div>` : ""}
      </div>
      <div class="foot">${s.foot || `${brand.academy}: ${brand.tagline.charAt(0) + brand.tagline.slice(1).toLowerCase()}`}</div>`),
    note: (t, s) => page(s.chapter || "Good to know", s.num || "", `<div class="wrap" style="display:flex;align-items:center">
      <div class="card" style="width:100%;padding:52px 60px">
        <div style="display:flex;align-items:center;gap:22px"><div class="ic" style="width:78px;height:78px;border-radius:22px">${I(s.icon || "shield", "currentColor", 40)}</div><div><div class="eyebrow">${s.eyebrow || "Important"}</div><div style="font-size:46px;font-weight:780;letter-spacing:-.03em;margin-top:8px">${s.heading}</div></div></div>
        <div style="display:grid;grid-template-columns:repeat(${s.points.length},1fr);gap:20px;margin-top:38px">${s.points.map(([ok, x], k) => `<div data-r="${Math.min(k, (s.lines?.length || 1) - 1)}" style="display:flex;gap:14px;align-items:flex-start;font-size:21px;font-weight:620;background:${ok ? C.goodSoft : C.warnSoft};border:1px solid ${ok ? C.good + "55" : C.warn + "55"};border-radius:16px;padding:18px">${I(ok ? "check" : "x", ok ? C.good : C.warn, 26, 2.4)}<span>${x}</span></div>`).join("")}</div>
        ${s.footer ? `<div style="margin-top:32px;padding-top:26px;border-top:1px solid ${C.line};font-size:22px;font-weight:680;color:${C.primary}">${s.footer}</div>` : ""}
      </div></div>`),
    email: (t, s) => page(s.chapter || "Step by step", s.num || "", `<div class="wrap" style="top:118px">
      <div style="display:grid;grid-template-columns:400px 1fr;gap:34px;height:100%">
        <div><div class="eyebrow">${s.eyebrow || "In the inbox"}</div><h1 style="font-size:50px">${s.heading}</h1><p class="lead" style="font-size:21px">${s.lead || ""}</p></div>
        <div data-r="0" class="win" style="height:640px;display:flex;flex-direction:column"><div class="wbar"><i></i><i></i><i></i><span>Inbox · ${s.to}</span></div>
          <div style="padding:16px 22px;border-bottom:1px solid ${C.line};background:${C.surface}"><div style="font-size:19px;font-weight:720">${s.subject}</div><div style="font-size:14px;color:${C.muted};margin-top:4px">To: ${s.to}</div></div>
          <iframe srcdoc="${s.html.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" style="flex:1;border:0;width:100%;background:#fff"></iframe></div>
      </div></div>`),
    html: (t, s) => page(s.chapter || "", s.num || "", s.body),
    /** Numbered steps beside a desktop browser window (an illustration). */
    desktop: (t, s) => page(s.chapter || "Step by step", s.num || "03", `<div class="wrap" style="right:auto;width:640px">
      <div class="eyebrow">${s.eyebrow || "Step by step"}</div><h1 style="font-size:50px">${s.heading}</h1>
      <div style="margin-top:30px;display:grid;gap:16px">${s.steps.map(([h, x], k) => `<div data-r="${Math.floor((k * (s.lines?.length || 1)) / s.steps.length)}" class="card" style="display:flex;gap:16px;align-items:flex-start;padding:20px 24px"><span style="width:42px;height:42px;flex:none;border-radius:50%;background:${C.primary};color:${C.onPrimary};display:grid;place-items:center;font-size:19px;font-weight:780">${k + 1}</span><div><h2 style="font-size:23px">${h}</h2><p style="margin-top:5px;font-size:18px">${x}</p></div></div>`).join("")}</div></div>
      <div style="position:absolute;right:-120px;top:150px;width:860px">${s.shot ? win(s.shot) : ""}</div>
      ${s.overlay ? `<div data-r="${s.overlayAt ?? 0}" style="position:absolute;right:120px;top:205px;width:400px;background:${C.surface};border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.45);border:1px solid ${C.lineStrong};padding:20px 22px;font-family:system-ui">${s.overlay}</div>` : ""}
      <div style="position:absolute;right:300px;bottom:40px;font-size:14px;font-weight:700;letter-spacing:.14em;color:${C.muted}">ILLUSTRATION</div>`),
    /** Stage for a live phone recording: text on the left, an empty phone frame on the right.
     *  The screen area (CSS 920,69 336x727) is filled with the recording at assembly. */
    phonestage: (t, s) => page(s.chapter || "On your phone", s.num || "", `<div class="wrap" style="right:auto;width:740px;display:flex;flex-direction:column;justify-content:center">
      <div class="eyebrow">${s.eyebrow || "On your phone"}</div><h1 style="font-size:52px">${s.heading || t.short}</h1>
      <div style="margin-top:30px;display:grid;gap:14px">${(s.points || []).map((x, k) => `<div style="display:flex;gap:14px;align-items:flex-start;font-size:22px;color:${C.body};line-height:1.4"><span style="width:34px;height:34px;flex:none;border-radius:50%;background:${C.primary};color:${C.onPrimary};display:grid;place-items:center;font-size:16px;font-weight:780">${k + 1}</span><span>${x}</span></div>`).join("")}</div></div>
      <div style="position:absolute;left:906px;top:55px;width:364px;height:755px;border-radius:52px;background:#05060f;box-shadow:0 40px 80px rgba(0,0,0,.45)"></div>
      <div style="position:absolute;left:920px;top:69px;width:336px;height:727px;border-radius:40px;background:${C.bg}"></div>`, ".chap{display:none}"),
    /** Numbered steps beside a phone frame (an illustration of the device). */
    phone: (t, s) => page(s.chapter || "Step by step", s.num || "03", `<div class="wrap" style="right:auto;width:820px">
      <div class="eyebrow">${s.eyebrow || "Step by step"}</div><h1 style="font-size:52px">${s.heading}</h1>
      <div style="margin-top:34px;display:grid;gap:18px">${s.steps.map(([h, x], k) => `<div data-r="${s.reveal ? s.reveal[k] : Math.floor((k * (s.lines?.length || 1)) / s.steps.length)}" class="card" style="display:flex;gap:18px;align-items:flex-start;padding:22px 26px"><span style="width:44px;height:44px;flex:none;border-radius:50%;background:${C.primary};color:${C.onPrimary};display:grid;place-items:center;font-size:20px;font-weight:780">${k + 1}</span><div><h2 style="font-size:24px">${h}</h2><p style="margin-top:6px;font-size:19px">${x}</p></div></div>`).join("")}</div></div>
      <div style="position:absolute;right:150px;top:120px;width:330px;height:680px;border-radius:54px;background:#05060f;padding:14px;box-shadow:0 40px 80px rgba(0,0,0,.45)">
        <div style="width:100%;height:100%;border-radius:42px;overflow:hidden;position:relative;background:${C.bg}">${s.shot ? `<img src="${img(s.shot)}" style="width:100%;display:block">` : ""}
          ${s.overlay ? `<div data-r="${s.overlayAt ?? 0}" style="position:absolute;left:0;right:0;bottom:0;background:#F2F2F7;border-radius:22px 22px 0 0;padding:16px 14px 26px;box-shadow:0 -10px 30px rgba(0,0,0,.18)">${s.overlay}</div>` : ""}
          <div style="position:absolute;top:10px;left:50%;margin-left:-55px;width:110px;height:30px;border-radius:20px;background:#05060f"></div></div>
        <div style="position:absolute;bottom:-44px;left:0;right:0;text-align:center;font-size:14px;font-weight:700;letter-spacing:.14em;color:${C.muted}">ILLUSTRATION</div></div>`),
  };
  return { page, I, win, img, T, LOGO, LOGO_INV, blueBg, CSS };
}
