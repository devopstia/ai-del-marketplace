#!/usr/bin/env node
// Google Authenticator codes (RFC 6238) for local demo accounts and test scripts. Never used by the app itself.
//   node scripts/totp.mjs [secret]      prints the current code (default: SEED_MFA_SECRET from .env)
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function decode(s) {
  let bits = 0, value = 0; const out = [];
  for (const ch of s.toUpperCase().replace(/[\s=-]/g, "")) { value = (value << 5) | A.indexOf(ch); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
export const stepNow = () => Math.floor(Date.now() / 30000);
export function totp(secret, step = stepNow()) {
  const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", decode(secret)).update(c).digest(); const o = h[h.length - 1] & 15;
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, "0");
}
export const seedSecret = () => process.env.SEED_MFA_SECRET || readFileSync(new URL("../.env", import.meta.url), "utf8").match(/^SEED_MFA_SECRET=(.*)$/m)?.[1]?.trim() || "";
/** Codes are single use per account: wait for a step after `lastStep` (at most 30 s). */
export async function freshCode(secret, lastStep) {
  while (lastStep !== undefined && stepNow() <= lastStep) await new Promise((r) => setTimeout(r, 1000));
  return { code: totp(secret), step: stepNow() };
}
if (import.meta.url === `file://${process.argv[1]}`) console.log(totp(process.argv[2] || seedSecret()));
