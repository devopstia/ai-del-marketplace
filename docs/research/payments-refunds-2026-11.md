# Research: revenue split after Stripe fees, refunds, disputes, refund policy (2026-11-24)

Scope: DEL's NestJS marketplace (platform account is merchant of record; Stripe Checkout; **separate charges and transfers**
(SC&T); v2 recipient accounts with `fees_collector=application`, `losses_collector=application`; see
`apps/api/src/commerce/{fulfilment,commerce,refunds,webhooks,connect}.service.ts`). Today the code transfers each line's share
right after fulfilment (`source_transaction`), reverses transfers on refund, and only logs disputes.
Every claim has a source URL; **[unverified]** = not confirmed on a primary page (secondary source, or my inference).
Not legal/tax advice. Have an accountant/lawyer check the tax, 1099 and consumer-law points before go-live.

---

## A. Stripe mechanics

### A1. Getting the exact Stripe fee, when it is available, FX, and splitting it across lines
- With SC&T the Stripe fee is debited from the **platform** balance: "Your account balance is debited for the cost of the
  Stripe fees, refunds, and chargebacks." Stripe's own example: a $100 charge, a $3.20 fee, $96.80 to the platform's pending balance,
  then transfers of $70 and $20, and the $6.80 left over is the platform's take. https://docs.stripe.com/connect/separate-charges-and-transfers.md?platform=web&integration=checkout&ui=stripe-hosted
- The fee is on the charge's **balance transaction** (`fee`, `fee_details[]`, `net = amount - fee`, `exchange_rate`, `currency`,
  `available_on`). `fee_details[].type` values: `application_fee`, `payment_method_passthrough_fee`, `stripe_fee`, `tax`,
  `withheld_tax`. https://docs.stripe.com/api/balance_transactions/object · https://docs.stripe.com/changelog/2013-08-13/fee-details-moved-balance-transactions
- **Timing. It is not synchronous, and it is not reliably present in `checkout.session.completed`.** Since API 2024-04-10 the default
  `capture_method` is `automatic_async`, and balance transactions "are created after the payment succeeds, but asynchronously in the
  background". `charge.balance_transaction` "might be `null` immediately after confirmation". Listen for **`charge.updated`**, which
  carries `balance_transaction` once it is ready. Expand `latest_charge.balance_transaction` on the PaymentIntent. **IC+ pricing
  users can't read fees from the balance transaction** and must use the Payment fees report. https://docs.stripe.com/expand/use-cases
  → Implementation: on `checkout.session.completed`, fulfil the enrolment right away. Run the money split later, in a
  `charge.updated` handler, or in a BullMQ job that retries the `charges.retrieve(expand balance_transaction)` until it is non-null.
- **Currency.** The balance transaction is in the **settlement** currency. `exchange_rate` converts the source amount to the
  destination amount (https://docs.stripe.com/api/balance_transactions/object). With `source_transaction`, "the currency of the
  balance transaction associated with the charge must match the currency of the transfer" (SC&T page above). So compute the split
  in the settlement currency: take `bt.amount` and `bt.fee` from Stripe and convert the tax with `exchange_rate` (or pro-rate it).
  Stripe uses the mid-market rate plus a conversion fee (https://docs.stripe.com/connect/currencies). US pricing adds +1% when
  conversion is needed and +1.5% for international cards (https://stripe.com/pricing). The simplest course is to price in USD only
  until there is demand for other currencies.
- **Allocating one charge's fee across lines (recommended algorithm):**
  1. `taxable_base_i` = line amount after discounts, excluding tax (`line_items[].amount_subtotal - amount_discount`, or
     `amount_total - amount_tax` for inclusive tax).
  2. `fee_i = fee × base_i / Σbase` in integer cents, using the **largest-remainder method** (floor each share, then hand the leftover
     cents to the lines with the biggest fractional parts; break ties by line id). The parts then sum to the fee exactly.
     The fee is charged on the full amount *including* tax. We allocate all of it to the revenue lines (DEL's choice: simple, and the
     tax part of the fee is tiny).
  3. `net_i = base_i - fee_i`. `instructor_i = round_half_up(net_i × bps_i / 10000)`. `platform_i = net_i - instructor_i`
     (platform takes the remainder, so the total always reconciles to `bt.net - tax`).
  4. Store `stripeFeeCents`, `exchangeRate`, `balanceTxnId` on the order and `feeCents`, `netCents`, `instructorShareCents`,
     `commissionBps` on each line. These are immutable snapshots, so a later override can't change past sales.
  Only `stripe_fee` belongs in the split. The Stripe Tax fee is a separate `tax_fee` balance transaction
  (https://docs.stripe.com/api/balance_transactions/object), which I'd treat as a platform cost.

### A2. Does Stripe return the fee on a refund?
- **No.** "For all refunds, payment processing, Connect, and currency conversion fees from the original charge are not returned."
  Issuing a refund has no fee on standard pricing, except for bank-transfer payment methods. https://support.stripe.com/questions/understanding-fees-for-refunded-payments
- Implication: a full refund costs the platform the original fee ($3.20 on $100) and **nobody gets it back**. The ledger must
  decide who bears that fee (see policy B4 and example C2). Partial refunds: pro-rate by refunded base, and the fee stays sunk.

### A3. Transfer reversals, after payout, negative balances, holds
- "Refunding a charge has no impact on any associated transfers." The platform must recover by reversing transfers or by
  reducing later transfers. Reversals can be full or partial and should be used "only for refunds or disputes related to the
  charge, or to correct errors". (SC&T page above.) Partial reversals are allowed "as many times as you wish", up to the unreversed
  amount. https://docs.stripe.com/api/transfer_reversals/create
- **After the instructor has been paid out:** the SC&T guide says "It's only possible to reverse a transfer if the connected
  account's available balance is greater than the reversal amount or has connected reserves enabled" (SC&T page). Stripe's
  risk guide adds that if the balance can't cover a refund "you can reverse the transfer without issuing the refund, which results in
  a negative balance on the account" (https://docs.stripe.com/connect/risk-management/best-practices). So a reversal *can* push a
  platform-liable account negative. When Stripe is liable instead, the reversal can simply fail (https://docs.stripe.com/connect/disputes).
  **[unverified]**: the exact behaviour for v2 *recipient* accounts with `losses_collector=application`. Test it in sandbox and
  handle both a failed reversal and a negative balance.
- **Negative balance, who pays:** v2 `defaults.responsibilities.losses_collector` = `application` means the **platform** covers it.
  Stripe offsets the negative balance against future funds and, if `debit_negative_balances` is on, debits the instructor's bank
  (supported in US, CA, SEPA/UK, AU, NZ). While the balance is negative, payouts stop. Stripe holds a **reserve on the platform
  balance** (`reserve_transaction`). After **180 days** negative, Stripe takes the platform's money (`connect_collection_transfer`).
  https://docs.stripe.com/connect/account-balances
  → In practice DEL bears any clawback it can't recover. The cleanest recovery is an **internal ledger debit netted against the
  instructor's next transfers**, with a Stripe reversal only when the balance covers it.
- **Holding funds:** Stripe allows holding "in the platform balance before transferring" or holding in the connected balance before
  paying out. It advises holding only for "a clear purpose", not arbitrarily. Compliance caps on holding: **US 2 years**, most other
  countries 90 days (https://docs.stripe.com/connect/account-balances). A refund window is a clear purpose (inference).
- **`delay_days` doesn't help with SC&T.** `settlement_timing.delay_days` / `delay_days_override` (max **31**) covers
  "`on_behalf_of` charges (or direct charges performed on the connected account)" (https://docs.stripe.com/connect/manage-payout-schedule).
  A transfer with `source_transaction` "takes on the pending status of the associated charge" (SC&T page). So for SC&T the hold is
  **when DEL creates the transfer**. Separately, the platform can set recipients' payout `interval` to `weekly`/`monthly`/`manual`
  through the Balance Settings API (https://docs.stripe.com/api/balance-settings/object), which cuts payout fees and gives a buffer.
- Payout costs when the platform handles pricing: $2 per active account per month, plus 0.25% + 25¢ per payout
  (https://stripe.com/connect/pricing). Batching payouts weekly or monthly matters.

### A4. Disputes under SC&T
- "For destination charges and separate charges and transfers, with or without `on_behalf_of`, Stripe debits dispute amounts and fees
  from your platform account." The platform responds to the dispute. Recover with a transfer reversal: accept → reverse right away;
  challenge → wait for the result, reverse only if lost. Stripe offers no-code Workflows that reverse automatically.
  https://docs.stripe.com/connect/disputes
- Fees (US): **$15 dispute received fee**, **$15 dispute countered fee** (refunded if you win), $15 appeal fee (never refunded).
  https://stripe.com/pricing. **[unverified]**: whether the $15 received fee is returned on a win. The pricing page doesn't say it is.
- Code gap: `webhooks.service.ts` only logs `charge.dispute.created`. Needed: freeze the line's pending payout, revoke or suspend
  access (policy choice), handle `charge.dispute.closed` (status `lost`/`won`), reverse or restore the transfer, and write an audit entry.

### A5. Taxes (platform is merchant of record)
- Stripe Tax on Checkout: `automatic_tax[enabled]=true`. It only collects where DEL has an active registration. Read the result from
  `total_details.amount_tax`. https://docs.stripe.com/tax/checkout/page
- For SC&T with platform liability, set `automatic_tax[liability][type]=self` (and invoice `issuer` self).
  https://docs.stripe.com/tax/tax-for-marketplaces
- `tax_behavior`: **exclusive** (tax added on top, the US norm) or **inclusive** (the customer pays the list price; tax is inside it).
  "Automatic" = exclusive for USD/CAD and inclusive elsewhere. It can't be changed once set on a Price.
  https://docs.stripe.com/tax/products-prices-tax-codes-tax-behavior
- **The split base must exclude tax.** Tax is a liability to the authority, not revenue. Exclusive: base = subtotal after discount.
  Inclusive: base = line total − line tax. Refunds return tax pro rata, and the Stripe Tax refund handling must mirror it.
- Marketplace facilitator / deemed seller: many US states and other countries require the marketplace operator to collect tax on
  facilitated sales (https://docs.stripe.com/tax/tax-for-marketplaces). DEL is already the seller of record, so it is liable
  either way [high level; tax advisor]. Stripe Tax pricing: 0.5% per transaction (no-code) or $0.50 per transaction (API) where
  registered (https://stripe.com/pricing).
- Alternative noted: **Stripe Managed Payments** (Stripe as merchant of record for digital goods) **does not support Connect**, so it
  doesn't fit a marketplace. https://docs.stripe.com/payments/managed-payments

### A6. Alternatives and recommendation
| Option | Fit for a multi-instructor cart | Notes |
|---|---|---|
| Destination charge + `application_fee_amount` / `transfer_data[amount]` | ❌ one `transfer_data[destination]` per charge | The cart would need one charge per instructor: several card charges, a 30¢ fixed fee each, worse UX. The transfer is immediate, so a refund window hold isn't possible. https://docs.stripe.com/connect/destination-charges.md?platform=web&ui=stripe-hosted |
| …with `on_behalf_of` | ❌ | Needs a payments capability. **Recipient-agreement accounts can't request `card_payments`** (same page). |
| Direct charges | ❌ | The instructor becomes merchant of record, which conflicts with DEL as seller and tax collector. |
| **SC&T (current)** | ✅ many transfers per charge, timing controlled by the platform | Stripe: "We recommend using separate charges and transfers only when you're responsible for negative balances", which DEL is (SC&T page). |
**Recommendation: keep SC&T.** Change the timing: create transfers **after the refund window** using after-fee, after-tax amounts.
Note: "funds segregation" (private preview) can earmark allocated funds; worth asking Stripe about once live (SC&T page).

### A7. "Pay to DEL" instructors and DEL's own courses
- Not transferring is simply the absence of a Transfer. A transfer needs a permitted use case. Nothing requires the platform to
  transfer (SC&T page: "amount determined by you"). There's no self-transfer to the platform; DEL's lines just keep `transferStatus='none'`.
  No Stripe page prohibits this **[unverified: there's no explicit statement either way; it's inference from how transfers work]**.
- Bookkeeping: for DEL courses and pay-to-DEL lines the whole net is DEL revenue in Stripe. For pay-to-DEL, keep the computed
  instructor share in the ledger as `payee=DEL (agreement #id)` so statements, commission reports and any off-Stripe settlement
  (payroll or contractor invoice) are auditable. Audit-log the agreement switch (super admin only, with effective date; never retroactive).
- 1099: when the platform controls pricing (`fees_collector=application`), "the platform is responsible for filing any relevant 1099
  forms". Stripe can generate 1099-NEC/MISC/K, and the threshold is $2,000 for NEC/MISC in the current docs.
  https://docs.stripe.com/connect/tax-reporting. Pay-to-DEL instructors receive no Stripe payments. Any compensation DEL pays them
  goes through DEL's normal payroll/contractor reporting [tax advisor].

### A8. Reporting and reconciliation via the API
- List balance transactions by payout (`/v1/balance_transactions?payout=po_…&expand[]=data.source`). This works only for
  **automatic** payouts. https://docs.stripe.com/expand/use-cases
- Reports API: `payout_reconciliation.itemized.1–7` / `.summary.1–2` / `.by_id.*`
  (https://docs.stripe.com/reports/report-types/payout-reconciliation). Connect reports include
  `connected_account_balance_change_from_activity.itemized.*`, `connected_account_payout_reconciliation.*`,
  `connected_account_ending_balance_reconciliation.*`, `connected_account_stripe_fees.*`,
  `connect.negative_balance_refunds_disputes_overview.1`. The by-id payout report includes `source_transaction_id` for SC&T.
  https://docs.stripe.com/reports/report-types/connect · index: https://docs.stripe.com/reports/report-types
- Suggested nightly job: pull the platform `balance_change_from_activity` itemized report, then match each `charge`/`refund`/
  `transfer`/`transfer_reversal`/`dispute` row to the ledger by id (`transfer_group = order.id`, transfer metadata `order_line_id`)
  and raise an admin alert on any mismatch.

---

## B. Refund policies

### B1. Competitors (current, as found)
| Platform | Window & conditions | Instructor side / disputes |
|---|---|---|
| **Udemy** | 30 days for eligible courses. It can deny when "a significant portion" was consumed or downloaded, for repeat refunds, or for excessive refunds. Some refunds are given as Udemy credit. https://support.udemy.com/hc/articles/229604248-Refund-a-Course (official page returned 403. Text from search snippet and mirror https://kvzcldemo.zendesk.com/hc/en-us/articles/4407079027095-Udemy-s-Refund-Policy **[partly unverified]**) | Instructors are paid after the 30-day window: "payments are sent to instructors after 30 days". The Month 3 payment = (Month 1 sales after deductions − refunds) × share. Share is 37% for organic sales, 97% with the instructor's coupon. https://support.udemy.com/hc/articles/229605008-Instructor-revenue-share · https://support.udemy.com/hc/articles/229604008-Instructor-Payment-Overview (via search/mirror **[partly unverified]**) |
| **Coursera** | One-time course purchase: full refund within **7 days** or before earning a certificate, whichever comes first. Coursera Plus Annual: 14 days. It can deny if "a significant portion of the content has been accessed". EU/UK: 14-day withdrawal right. https://www.coursera.org/about/terms | Partner revenue terms aren't public. |
| **edX** | Certificate track: 14 days after payment. No obligation to refund once a certificate is earned. Nothing after 6 months. Subscriptions are non-refundable. https://www.edx.org/edx-terms-service | n/a |
| **Skillshare** | Subscription. The official help centre says it reviews refunds only "in extraordinary circumstances" (e.g. fraud). A trial conversion is refundable if requested within 48 h. Annual 14-day claims appear only on third-party sites **[unverified]**. https://help.skillshare.com/hc/articles/204536798 | Royalty pool by minutes watched **[unverified]** |
| **Pluralsight** | Subscription, cancel any time, access continues to term end. No published refund window confirmed (official refund page returned 403) **[unverified]**. https://help.pluralsight.com/help/cancel | n/a |
| **LinkedIn Learning** | Premium rules: "may be refundable within 7 days… without Premium usage". EU consumers get a full refund within 14 days of the subscription start. https://www.linkedin.com/help/billing/answer/5704 | n/a |
| **Domestika** | 14 days from course purchase (third-party sources only) **[unverified]** | n/a |
| **Maven** | "Maven Guarantee" courses: refund through the course midpoint (under 4 weeks) or through the end of week 2. **Self-paced: 14 days and <25% completed.** Maven may limit or deny. https://help.maven.com/en/articles/8705540-maven-s-satisfaction-guarantee | Instructor-issued refunds also refund Maven's 10% fee. The Stripe fee isn't returned (search snippet of https://help.maven.com/en/articles/5597391-issuing-refunds-to-students **[unverified]**) |
| **Teachable (Teachable Pay)** | Default **14 days**. A school can set a longer window. An admin can refund manually up to 30 days. Later refunds only if the school has unpaid earnings. https://support.teachable.com/en/articles/11682538-issue-student-refunds | **$15 chargeback fee charged to the creator** and returned if the dispute is won. Preemptive refunds are encouraged. https://support.teachable.com/en/articles/11682559-chargebacks |

Pattern: 14 days is the modern norm (Coursera Plus, edX, Teachable, Maven self-paced, Domestika). The best practice is to pair it
with a **consumption limit** (Maven 25%, Coursera/Udemy "significant portion") and a **certificate cut-off** (Coursera, edX).
Udemy's 30 days is tied to holding instructor pay for the whole window.

### B2. Law
- **EU** (Consumer Rights Directive 2011/83 as amended by 2019/2161): 14-day withdrawal. For digital content not on a tangible medium,
  the period runs from contract conclusion (Art 9(2)(c)). The right is **lost once performance has begun** if the consumer gave
  **prior express consent**, **acknowledged losing the right**, and the trader sent **confirmation** (Art 7(2)/8(7)) (Art 16(m)).
  If any of these is missing, the consumer pays nothing for content already consumed (Art 14(4)(b)).
  https://eur-lex.europa.eu/eli/dir/2011/83/2022-05-28/eng
- **UK** (CCRs 2013 reg 37): same structure. Express consent plus acknowledgement ends the right once supply begins. Failure to send
  the confirmation (reg 12(5)/16(3)) means the consumer pays nothing. https://www.legislation.gov.uk/uksi/2013/3134/regulation/37.
  **[unverified]**: whether the DMCC Act 2024 changes this by 2026.
- Separately, faulty or not-as-described digital content has statutory remedies regardless of the above (EU Digital Content
  Directive 2019/770; UK Consumer Rights Act 2015) **[unverified, not fetched]**.
- **US:** there's no general federal refund right for online purchases. The FTC Cooling-Off Rule excludes sales "made entirely
  online". https://consumer.ftc.gov/articles/buyers-remorse-ftcs-cooling-rule-may-help. Card-network chargeback rights still apply,
  and some states require a posted refund policy **[unverified]**.
- Checkout UX consequence (EU/UK): add an unticked checkbox: "I want immediate access and understand I lose my 14-day withdrawal
  right once I start streaming", store the consent, and include it in the receipt email. Then DEL's voluntary policy below
  (14 days and under 25% watched) is lawful, and it is more generous than the statutory position.

### B3. Recommended policy for this marketplace
1. **Window:** 14 calendar days from purchase, for individual course purchases (not future subscriptions or bundles bought with
   credits). Refunds go to the original payment method, never as credit.
2. **Consumption limit:** eligible if **under 25% of the course's video duration has been watched** (server-side progress) **and**
   no downloadable resources of more than 25% of the course have been downloaded. Show "Refund eligible until <date> · 18% watched" on
   the order page so the rule is transparent.
3. **Certificate rule:** once a certificate of completion is issued, the purchase is not refundable. Issuing a certificate requires
   completion anyway, which would exceed 25%.
4. **Abuse limit:** automatic approval for at most **3 refunds per rolling 12 months** per account. After that, admin review. A course
   refunded once can't be refunded again on repurchase. Refund-then-rebuy patterns and accounts linked by payment fingerprint
   (`card.fingerprint`) are flagged.
5. **Exceptions (admin, audited, any time):** duplicate purchase, technical failure, content materially not as described or removed
   by the instructor, legal requirement. These can be outside the window, after payout (see the ledger rule below).
6. **Effect of a refund:** enrolment revoked, progress kept but hidden, any certificate revoked.

### B4. Instructor-side treatment and payout hold
- **Hold:** each line's instructor share is `pending` for **14 days + 2 days buffer = day 16**. A daily BullMQ job then creates the
  transfer (`source_transaction`, idempotency key `transfer:<lineId>`). By day 16 card funds are normally available, so the transfer
  lands as available. With the instructor payout schedule **weekly** (or monthly once volume grows), payout fees stay low.
  Instructor dashboard: Pending (in window) → Available (transferred) → Paid out.
- **Refund inside the window:** no transfer exists. The line's share is cancelled, so the instructor gets $0. **The platform absorbs
  the unrecoverable Stripe fee** (as part of running a generous refund policy; it's covered by the 20%). This is the simplest
  rule and the one instructors find fairest. Option if refunds become costly: charge instructors with refund rates above X% their
  share of the fee.
- **Refund after the transfer (exceptions):** the instructor bears their share of the refunded net (`instructor_i × refunded/base`).
  Recovery order: (1) net it against pending or next transfers (ledger debit), (2) transfer reversal if the instructor's Stripe
  balance covers it, (3) otherwise carry the negative ledger balance. DEL bears it if it is never recovered (Stripe makes the platform
  liable; A3). Audit-log every step.
- **Disputes:** the line is frozen at `charge.dispute.created`. If still pending, the transfer is skipped until the dispute closes.
  **Lost:** the instructor's share is reversed or debited. **Dispute fees ($15 received + $15 countered) are borne by DEL**, because DEL
  runs checkout and fraud tooling. Pass them to the instructor only for upheld "product not as described" disputes, per the
  instructor agreement. **Won:** release the share.
- **Commission:** default 8000 bps instructor. A per-instructor override is set by super admin with reason and effective date,
  written to the audit log (`commission.override_set`). The bps value is snapshotted on each order line at purchase.

---

## C. Worked examples (USD, US card, standard 2.9% + 30¢; no tax unless stated)

**C1. $100 independent instructor course, fee $3.20.** Net = 100.00 − 3.20 = **96.80** → instructor 80% = **77.44**, DEL **19.36**.
Day 16: transfer $77.44 (source_transaction = charge). DEL balance: +96.80 − 77.44 = +19.36.

**C2a. Refund on day 10, before transfer.** Refund $100 to the student. The $3.20 fee is not returned (A2). The line is cancelled
and no transfer is ever made. Instructor **0.00**. DEL: +96.80 − 100.00 = **−3.20** (the absorbed fee).

**C2b. Refund on day 10, but the transfer was already made** (today's code transfers immediately). DEL: +96.80 − 77.44 (transfer)
− 100.00 (refund) + 77.44 (reversal) = **−3.20**. Instructor: +77.44 − 77.44 = 0. If the instructor already paid out the $77.44 and
the balance is 0: the reversal either fails or drives the recipient balance to **−77.44**. Stripe then reserves $77.44 of DEL's
balance, offsets the next transfers, or debits the bank (if enabled). After 180 days it collects from DEL (A3). Under the
recommended hold, this case only happens for exceptions after day 16, and it is handled by ledger netting.

**C3. Two-instructor cart: A $100 + B $50 = $150, one charge.** Fee = 2.9% × 150 + 0.30 = **4.65** (two separate checkouts would
cost 3.20 + 1.75 = 4.95). Largest-remainder allocation: A 4.65 × 100/150 = **3.10**, B **1.55**.
A: net 96.90 → instructor **77.52**, DEL 19.38. B: net 48.45 → instructor **38.76**, DEL 9.69.
Check: 150 − 4.65 − 77.52 − 38.76 = **29.07** = 19.38 + 9.69 ✔. Two transfers, both `source_transaction` = the same charge
(allowed while Σ ≤ charge).
Refund of B only (day 5): refund $50, B's transfer never created, DEL absorbs B's 1.55 fee. A is unaffected.

**C4. DEL's own $100 course (or a pay-to-DEL instructor).** Net 96.80. No transfer. DEL keeps **96.80**. For pay-to-DEL, the ledger
records instructor share 77.44 as `payee=DEL (agreement)`, and the Stripe cash is identical. Mixed cart (DEL $100 + A $50, fee 4.65):
DEL line fee 3.10 → net 96.90 all DEL. A: fee 1.55 → net 48.45 → A 38.76 / DEL 9.69.

**C5. Dispute lost, after the day-16 transfer.** Sale: DEL +96.80, transfer −77.44. Dispute: −100.00 −15.00 (received). DEL
counters: −15.00 (countered fee, kept by Stripe because DEL lost). Lost → reverse the transfer: +77.44.
DEL net = 96.80 − 77.44 − 100 − 15 − 15 + 77.44 = **−33.20**. Instructor 0.
If DEL accepts instead of countering: **−18.20**. If it wins: the $100 and the countered fee come back, and the $15 received fee is
presumably kept [unverified]. DEL ends at +19.36 − 15 = **+4.36**, and the instructor keeps 77.44 (don't reverse).
If the dispute opens during the hold, freeze the line: no transfer, so no reversal is needed.

**C6. Exclusive sales tax 8% on $100.** Customer pays 108.00. Fee = 2.9% × 108 + 0.30 = 3.432 → **3.43**. Base = 100.00 (tax 8.00
remitted by DEL). Net = 100.00 − 3.43 = **96.57** → instructor round(77.256) = **77.26**, DEL **19.31**. (Inclusive pricing at
$100 with 20% VAT: base = 83.33, fee 3.20, net 80.13 → 64.10 / 16.03.)

---

## D. Code changes this implies (for the proposal, not done)
1. Order/line schema: `stripeFeeCents`, `taxCents`, `balanceTxnId`, `exchangeRate`, `feeCents`, `netCents`, `commissionBps`,
   `payee` (`instructor|del`), `refundEligibleUntil`, `transferDueAt`, ledger table for debits and credits (refund, dispute, clawback).
2. Split on `charge.updated` (or a retrying job) instead of at checkout. Today `commerce.service.ts:134` splits the list price
   before any fee is known.
3. `fulfilment.service.ts`: move transfer creation to a daily job for lines past `transferDueAt` that are not refunded or disputed.
4. `refunds.service.ts`: student self-serve eligibility check (window, 25%, certificate, abuse count). Reversal only for lines
   already transferred. Ledger netting fallback.
5. `webhooks.service.ts`: handle `charge.dispute.created|updated|closed`, `charge.updated`, `transfer.reversed`, `refund.failed`.
6. Super-admin commission override and pay-to-DEL agreement, both audited. Nightly reconciliation job (A8).
7. Checkout: `automatic_tax` with `liability: self` once DEL registers. EU/UK immediate-access consent checkbox.
