/**
 * The version of the Terms of use and the Access and refunds policy a buyer accepts at checkout (owner 2026-11-26).
 * It is the "Last updated" date on /policies/terms and /policies/privacy (apps/web/src/lib/terms.ts holds the same
 * value). Change both together whenever the wording of those pages changes: an older checkout page is then refused
 * with `terms_outdated` and the learner accepts the new version.
 */
export const TERMS_VERSION = '2026-11-25';

export type TermsInput = { acceptTerms?: boolean; termsVersion?: string };

/** What the order records when the buyer accepted the current terms; null otherwise. */
export function termsAcceptance(input: TermsInput, ip: string | null, now = new Date()) {
  return input.acceptTerms === true && input.termsVersion === TERMS_VERSION
    ? { termsVersion: TERMS_VERSION, termsAcceptedAt: now, termsAcceptedIp: ip }
    : null;
}
