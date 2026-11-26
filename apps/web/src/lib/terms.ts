/**
 * The version of the Terms of use and the Access and refunds policy a buyer accepts at checkout (owner 2026-11-26).
 * Must equal TERMS_VERSION in apps/api/src/commerce/terms.ts: the API refuses an order without it (`terms_required`)
 * or with an older one (`terms_outdated`) and records version, time and IP on the order.
 * Change both, and TERMS_UPDATED, whenever the wording of /policies/terms, /policies/privacy or
 * /policies/access-and-refunds changes.
 */
export const TERMS_VERSION = "2026-11-25";
/** The "Last updated" line on the policy pages. */
export const TERMS_UPDATED = "25 November 2026";
