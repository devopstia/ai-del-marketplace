import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { env } from '../config/env';

/** The rules, shown on the sign-up form before anyone submits (owner 2026-11-25; NIST 800-63B style plus a mix). */
export const PASSWORD_POLICY = {
  minLength: 12,
  maxLength: 128,
  rules: [
    'At least 12 characters',
    'A mix of letters and numbers',
    'Not your email address or name',
    'Not a password that has appeared in a data breach',
  ],
} as const;

/** A short offline list, used when the breach service can't be reached (the strength rules still apply). */
const COMMON = new Set([
  'password1234', 'password12345', 'password123456', 'qwerty123456', 'qwertyuiop123', '123456789abc', 'abc123456789',
  'iloveyou1234', 'welcome12345', 'letmein12345', 'admin1234567', 'changeme1234', 'passw0rd1234', 'p@ssw0rd1234',
  'devops123456', 'kubernetes123', 'password2026!', 'summer2026!!', 'winter2026!!',
]);
const log = new Logger('PasswordPolicy');

export interface PasswordCheck { ok: boolean; problems: string[]; breached: boolean }

/** Every rule that fails, not just the first (fixing one at a time is a guessing game). */
export async function checkPassword(pw: string, who: { email?: string; name?: string } = {}, fetcher: typeof fetch = fetch): Promise<PasswordCheck> {
  const problems: string[] = [];
  if (pw.length < PASSWORD_POLICY.minLength) problems.push(`be at least ${PASSWORD_POLICY.minLength} characters`);
  if (pw.length > PASSWORD_POLICY.maxLength) problems.push(`be at most ${PASSWORD_POLICY.maxLength} characters`);
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) problems.push('mix letters and numbers');
  const lower = pw.toLowerCase();
  const local = who.email?.split('@')[0]?.toLowerCase();
  const nameParts = (who.name ?? '').toLowerCase().split(/\s+/).filter((x) => x.length >= 4);
  if ((local && local.length >= 4 && lower.includes(local)) || nameParts.some((n) => lower.includes(n))) problems.push('not contain your email address or name');
  let breached = COMMON.has(lower);
  if (!breached && problems.length === 0) breached = await pwned(pw, fetcher);
  if (breached) problems.push('not be a password that has appeared in a data breach');
  return { ok: problems.length === 0, problems, breached };
}

export const passwordMessage = (c: PasswordCheck) =>
  c.problems.length === 1 ? `Password must ${c.problems[0]}.` : `Password must ${c.problems.slice(0, -1).join(', ')} and ${c.problems.at(-1)}.`;

/**
 * Have I Been Pwned "range" API (k-anonymity): only the first 5 hex characters of the SHA-1 are sent; the match happens here.
 * Fails open after 2.5 s (the strength rules still apply), so an outage never blocks sign-ups.
 */
async function pwned(pw: string, fetcher: typeof fetch): Promise<boolean> {
  const e = env();
  if (!e.PASSWORD_BREACH_CHECK || (e.NODE_ENV === 'test' && fetcher === fetch)) return false;
  const sha = createHash('sha1').update(pw).digest('hex').toUpperCase();
  try {
    const r = await fetcher(`https://api.pwnedpasswords.com/range/${sha.slice(0, 5)}`, { headers: { 'Add-Padding': 'true', 'User-Agent': 'del-marketplace' }, signal: AbortSignal.timeout(2500) });
    if (!r.ok) return false;
    const suffix = sha.slice(5);
    return (await r.text()).split('\n').some((line) => { const [h, n] = line.trim().split(':'); return h === suffix && Number(n) > 0; });
  } catch (err) {
    log.warn(`breach check skipped: ${(err as Error).message}`);
    return false;
  }
}
