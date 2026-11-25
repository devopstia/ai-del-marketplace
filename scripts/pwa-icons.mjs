#!/usr/bin/env node
// App icons for the installable app (PWA), drawn from the DEL loop logo. Run after a logo change:
//   node scripts/pwa-icons.mjs
// Writes apps/web/public/icons/: icon-192/512 (rounded tile), maskable-192/512 (full-bleed, logo inside Android's safe
// circle) and apple-touch-icon (180, opaque; iOS rounds the corners itself).
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";

const out = new URL("../apps/web/public/icons/", import.meta.url);
mkdirSync(out, { recursive: true });
const LEFT = "M60,30 C48,14 34,8 22,10 C10,12 4,22 4,30 C4,38 10,48 22,50 C34,52 48,46 60,30";
const RIGHT = "M60,30 C72,46 86,52 98,50 C110,48 116,38 116,30 C116,22 110,12 98,10 C86,8 72,14 60,30";

/** logoWidth: share of the canvas the loop spans; rounded: tile corners (0 = square). */
const svg = (logoWidth, rounded) => {
  const s = (512 * logoWidth) / 120;
  const x = (512 - 120 * s) / 2;
  const y = (512 - 60 * s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b1f45"/><stop offset="1" stop-color="#0c0f22"/></linearGradient></defs>
  <rect width="512" height="512" rx="${rounded}" fill="url(#g)"/>
  <g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke-width="11" stroke-linecap="round">
    <path d="${LEFT}" stroke="#9d8fff"/><path d="${RIGHT}" stroke="#58c3f2"/>
  </g></svg>`;
};
const png = (markup, size) => new Resvg(markup, { fitTo: { mode: "width", value: size } }).render().asPng();

const tile = svg(0.74, 112);
const full = svg(0.56, 0); // maskable: the loop stays inside the central 80 % safe zone
for (const size of [192, 512]) {
  writeFileSync(new URL(`icon-${size}.png`, out), png(tile, size));
  writeFileSync(new URL(`maskable-${size}.png`, out), png(full, size));
}
writeFileSync(new URL("apple-touch-icon.png", out), png(svg(0.66, 0), 180));
console.log("icons written to apps/web/public/icons/");
