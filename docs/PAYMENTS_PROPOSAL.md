# Payments proposal: Stripe Connect flow, commission, refunds, disputes

**Status: proposal for the owner's approval (2026-11-24). No payment code has been changed.**
Evidence (every claim cited): `docs/research/payments-refunds-2026-11.md`. Not legal or tax advice: the refund wording and tax
set-up need a quick review by DEL's accountant/lawyer before live payments.

## 1. Roles and accounts
| Who | Stripe | Gets paid |
|---|---|---|
| **DEL** (owner, operator, super admin organisation) | The **platform account**. Every learner pays DEL (DEL is the seller of record and collects tax) | DEL's own course sales (100% of the net), the platform commission on every other sale, and the share of instructors who chose "pay to DEL" |
| **Independent instructor** (default) | Their own **connected account** (Stripe-hosted onboarding, they enter bank/ID details on Stripe, never in our forms) | Their share, by Stripe transfer after the refund window |
| **Instructor with a "pay to DEL" arrangement** | No connected account needed | Their share is recorded in our ledger as payable to DEL under a signed agreement (super admin sets it, audited, with an effective date; never retroactive). DEL settles with them outside Stripe (payroll/contractor) |

**Owner dashboards:** the super admin keeps the full admin console and gets a **"DEL Studio"** switch in the header that opens the
instructor studio scoped to DEL's own courses, sales and students (the same studio every instructor uses). Acting as DEL is
limited to super admins and every action is audited with the real user. The existing `courses@del.example` login keeps working for
staff who only manage DEL courses.

## 2. Checkout and payment flow (keep "separate charges and transfers")
Stripe's alternatives allow only one instructor per charge (a cart would become several card charges) or make the instructor the
seller; separate charges and transfers is the model Stripe recommends when the platform is responsible, as DEL is.

1. Learner checks out (one Stripe Checkout session for the whole cart, prices in USD, tax added by Stripe Tax once DEL registers).
2. `checkout.session.completed` → **access is granted immediately** (unchanged).
3. Stripe's exact fee arrives a moment later (`charge.updated` with the balance transaction) → we **calculate the split** and
   store it on each order line (snapshots: never recalculated later, so a commission change never alters past sales).
4. Each instructor line waits **16 days** (14-day refund window + 2 days buffer) as *Pending* in the instructor's dashboard.
5. A daily job then creates one Stripe **transfer** per line to the instructor's connected account (*Available*), and Stripe
   pays out to their bank on a **weekly** schedule (*Paid out*). Lines for DEL's own courses and "pay to DEL" instructors never
   create a transfer (no self-transfer).
6. Lines of instructors who haven't finished Stripe onboarding stay pending and are paid automatically once they are verified
   (as today).

## 3. Commission calculation (documented formula, shown to instructors)
For each course in an order:
```
base        = price paid for the course, after any discount, excluding tax   (tax is never revenue)
stripe_fee  = the order's actual Stripe fee × base / sum of bases            (cents, largest-remainder so parts add up exactly)
net         = base − stripe_fee
instructor  = round_half_up(net × instructor_rate)                           (default 80%, or the instructor's override)
platform    = net − instructor                                               (DEL takes the remainder, so totals always reconcile)
```
Examples (US card, standard 2.9% + 30¢):
| Sale | Fee | Net | Instructor | DEL |
|---|---|---|---|---|
| Your example: $100, fee $3.00 | 3.00 | 97.00 | **77.60** | **19.40** |
| $100, real fee $3.20 | 3.20 | 96.80 | 77.44 | 19.36 |
| Cart: A $100 + B $50, one fee $4.65 | 3.10 / 1.55 | 96.90 / 48.45 | A 77.52, B 38.76 | 29.07 |
| DEL's own $100 course | 3.20 | 96.80 | — | 96.80 |
| $100 + 8% US sales tax (customer pays $108) | 3.43 | 96.57 | 77.26 | 19.31 (tax $8 remitted) |

**Per-instructor rate:** super admin only, with a reason and effective date, written to the audit log; applies to sales after the
effective date. The instructor sees "Your rate: 80% of the net sale after Stripe's processing fee" plus a per-sale breakdown
(price → fee → net → your share → status). `/teach` states the same formula publicly.

## 4. Refund policy (recommended)
Research: 14 days is the modern norm (Coursera Plus, edX, Teachable, Maven self-paced); the fair ones add a consumption limit and a
certificate cut-off. Udemy's 30 days is tied to holding instructor pay for 30 days.
1. **14 days from purchase**, individual course purchases, **if less than 25% of the course video has been watched** and no
   certificate has been issued. Refund to the original card, never store credit.
2. Learners request it from their order page, which shows "Refund eligible until <date> · 18% watched"; eligible requests are
   approved automatically (max **3 per 12 months** per account, then admin review).
3. **Admin exceptions any time** (duplicate purchase, technical failure, content not as described or removed, legal requirement), audited.
4. A refund removes access (progress kept, certificate revoked).
5. **EU/UK buyers:** a checkbox at checkout ("I want immediate access and understand I lose the 14-day withdrawal right once I start
   watching"), stored and repeated in the receipt email; without it, EU/UK statutory withdrawal rules apply in full.

## 5. Who bears what
| Event | Instructor | DEL |
|---|---|---|
| Refund **inside** the window (no transfer made yet) | $0 for that sale, nothing to claw back | Refunds the learner; **absorbs Stripe's fee**, which Stripe never returns (e.g. −$3.20) |
| Refund **after** the transfer (admin exceptions only) | Their share of the refunded amount is recovered: first from their next transfers, then by Stripe reversal if their balance covers it | Refunds the learner; carries any amount that can't be recovered (Stripe makes the platform liable) |
| Dispute (chargeback) opened during the hold | Line frozen, no transfer until it closes | Responds to the dispute in Stripe |
| Dispute **lost** | Share reversed / recovered as above | Pays Stripe's dispute fees ($15, +$15 if contested); passed to the instructor only for upheld "not as described" disputes, per the instructor agreement |
| Dispute **won** | Share released | Gets the money back (the $15 dispute fee may be kept by Stripe) |

## 6. What changes in the code (after approval, on its own branch, with tests)
1. Order lines store fee, net, rate, share, payee (`instructor` / `DEL`), refund deadline and transfer due date; a small ledger
   table for recoveries (refund after transfer, lost disputes).
2. Split computed from the real fee (`charge.updated` / retrying job) instead of from the list price at checkout (today:
   `commerce.service.ts`, which splits the gross price, so instructors currently get 80% of gross).
3. Daily transfer job after the hold; instructor payout schedule set to weekly.
4. Self-serve refund requests with the eligibility rules; admin exceptions; ledger netting when a transfer was already made.
5. Disputes: handle created/closed, freeze and release, recovery, admin "Disputes" list.
6. Super-admin commission overrides and "pay to DEL" agreements (audited), the DEL Studio switch, instructor earnings breakdown,
   `/teach` terms text.
7. Nightly reconciliation against Stripe's balance report, with an admin alert on any mismatch.
8. Stripe Tax and the EU/UK consent checkbox (switched on when DEL registers for tax).
Everything is tested in Stripe's **test mode** (sandbox) with the Stripe CLI once test keys are in `.env`; until then the dev
test-payment mode uses a simulated fee so the full split, hold, refund and dispute paths are covered by automated tests.

## 7. Decisions needed
1. Approve keeping separate charges and transfers with the **16-day hold** and weekly instructor payouts.
2. Approve the **refund policy** (14 days, under 25% watched, no certificate, 3 per year auto-approved, admin exceptions).
3. Approve **DEL absorbing the Stripe fee on in-window refunds** and the dispute-fee rule above.
4. Approve the **"DEL Studio" switch** for super admins (instead of moving DEL's courses to the owner's personal account).
5. Stripe **test keys** in `.env` when you're ready, and the tax registration question for your accountant.
