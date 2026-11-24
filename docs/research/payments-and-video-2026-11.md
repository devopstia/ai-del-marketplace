# Research: Stripe Connect and secure video hosting (2026-11-24)

Collected from official docs by a research agent; re-verify before implementing. Items marked *(unverified)* were not
confirmed against a primary source.

## A. Stripe Connect for a multi-instructor course marketplace

**Accounts.** Stripe recommends the **Accounts v2 API** for new platforms (v1 Standard/Express/Custom are legacy). A v2 account
has configurations: `merchant` (accepts payments itself) and `recipient` (receives transfers, needed for indirect charges);
plus `dashboard` (full / Express / none) and `defaults.responsibilities.{fees_collector, losses_collector}`. The dashboard choice
can't be changed later. v1 is still needed for some cross-border recipients (recipient service agreement).
https://docs.stripe.com/connect/accounts-v2 · https://docs.stripe.com/connect/design-an-integration

**Onboarding.** Stripe-hosted (redirect) or embedded onboarding; Stripe handles KYC. Instructors never type API keys into our
forms. If there is no Stripe dashboard and Stripe is liable, the embedded onboarding / account-management / notification-banner
components are mandatory. For marketplaces Stripe recommends platform liability for negative balances.

**Charge types.**
| | Direct | Destination | Separate charges & transfers (SC&T) |
|---|---|---|---|
| Charge lives on | instructor account | platform | platform |
| Sellers per payment | one | one | many |
| One cart with several instructors | no | no | **yes** |
| Platform's cut | `application_fee_amount` | fee or smaller `transfer_data.amount` | transfer less than collected |
| Refunds / disputes borne by | instructor | platform (can reverse transfer) | platform (can reverse transfers) |
https://docs.stripe.com/connect/charges · https://docs.stripe.com/connect/separate-charges-and-transfers

- Without `on_behalf_of` the platform is the business of record (statement descriptor, settlement country, fees). A payment can
  name one `on_behalf_of` account only, so a mixed cart settles as the platform.
- SC&T: `transfer_group` per order; `source_transaction` so a transfer waits for funds; total transfers ≤ charge; **refunds don't
  reverse transfers automatically**; for async methods transfer after `charge.succeeded`. ~43 countries; cross-border transfers only
  within US/CA/UK/EEA/CH.
- DEL's own courses: plain platform charge, no transfer *(inference)*.

**Checkout + webhooks.** Checkout Session with `payment_intent_data[transfer_group]`; handle `checkout.session.completed`,
`checkout.session.async_payment_succeeded|failed`. For destination/SC&T, payment/refund/dispute events arrive on the platform
("Your account") endpoint; v2 account events (`v2.core.account.updated`, capability updates) are thin events on the platform
endpoint (not testable with the Stripe CLI locally). Subscribe: `payment_intent.succeeded|payment_failed`, `charge.refunded`,
`refund.failed`, `charge.dispute.*`, `payout.failed`. Idempotency keys on transfers/refunds; de-duplicate `event.id`.
https://docs.stripe.com/connect/webhooks

**Tax.** Liability depends on marketplace-facilitator rules (get advice). Platform-liable Stripe Tax works with destination and
SC&T (`automatic_tax[liability][type]=self`), not with direct charges. https://docs.stripe.com/tax/tax-for-marketplaces

**Payouts and fees.** First payout usually 7–14 days after the first live payment; then 2 business days (US/AU) or 3 business days
after a 7-day first payout (EU/UK/CA). Platform-priced processing (needed for SC&T): $2 per active account per month + 0.25% + 25¢
per payout; Instant Payouts 1%. Card processing ~2.9% + 30¢ US *(unverified)*. https://docs.stripe.com/payouts ·
https://stripe.com/connect/pricing

**Research recommendation.** SC&T with one Checkout Session per cart, platform as merchant of record, one transfer per instructor
(share minus commission) with `source_transaction`, held past the refund window or reversed on refund; instructors as v2
`recipient` accounts with platform loss liability and hosted/embedded onboarding. Simpler alternative: one destination charge per
instructor (no mixed cart).

## B. Secure video hosting

| | S3 + MediaConvert + CloudFront | Mux | Cloudflare Stream | Bunny Stream |
|---|---|---|---|---|
| Protected playback | CloudFront signed URLs/cookies | signed JWT | signed tokens + origin/IP rules | token auth |
| DRM | SPEKE + key provider | add-on $100/mo + per licence | not documented | Enterprise add-on |
| Captions | build it | auto captions (free, VOD) | AI captions | add-on |
| Creator uploads | presigned S3 | direct uploads | direct uploads (tus) | tus |
| Price | encode $0.0075–0.015/min + S3 + egress | storage $0.003/min/mo, delivery $0.001/min after 100k free min/mo | $5/1,000 min stored + $1/1,000 min delivered | from $0.01/GB stored, $0.005/GB delivered |
| Ops effort | high | low | low | low–medium |

Estimate for 300 × 6 min (1,800 min) and ~50k minutes watched per month: Mux ≈ $5/mo (+ free delivery tier), Cloudflare ≈ $60/mo,
Bunny < $15/mo, AWS ≈ $80 one-off encoding + S3/CloudFront. Research recommendation: **Mux** (lowest effort and cost at this size,
DRM later), Bunny as a budget fallback. Sources: mux.com/pricing, developers.cloudflare.com/stream, bunny.net/pricing/stream,
aws.amazon.com/mediaconvert/pricing.
