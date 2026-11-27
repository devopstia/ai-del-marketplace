# Payments

- **Checkout**: Stripe Checkout (hosted); card details never touch the marketplace. Webhooks
  (`/api/webhooks/stripe`) are signature-verified and idempotent; enrolment only after `checkout.session.completed`.
- **Keys**: Super Admin › Platform › Payments & Stripe (`/admin/payments`). Keys are checked with Stripe, stored sealed
  (AES-256-GCM, key derived from SESSION_SECRET) in `platform_settings`, never returned or logged (masked). Saving or
  removing keys needs the super admin's authenticator code; every change is in the audit log without the secret.
- **Mode**: test keys = test mode; learners see a "Test mode" notice on the cart and checkout. **Live keys are inert
  until a super admin authorises live payments** (typed `ENABLE LIVE PAYMENTS` + code) — the owner's explicit step.
- **Health**: the page shows the Stripe account, the webhook endpoint, the last event received, events in 7 days,
  failed orders and abandoned checkouts.
- **Instructors**: Stripe Connect Express onboarding (Instructor Studio › Payments & payouts); no instructor ever
  pastes a key. 80% of the net (after Stripe's fee) to the instructor, 20% to DEL (or an agreed rate set by a super
  admin); transfers after the 14-day refund hold; a payout is "completed" only when Stripe confirms the transfer.
- **Manual enrollment** payments are recorded by super admins and paid out by hand (docs/MANUAL_ENROLLMENT.md).

## Return-page safety net (owner 2026-11-28)
The webhook stays the main path. When the buyer comes back to `/checkout/success?order=…&session_id=…`, the page also
calls `POST /api/orders/:id/confirm` (signed-in owner of the order only; 20 per minute). The API reads **the order's
own** Checkout Session from Stripe (`checkout.sessions.retrieve`; the browser's `session_id` is only compared, never
trusted), checks that the session belongs to the order and that `amount_total` and currency match the order, and when
`payment_status` is `paid` runs the same idempotent `FulfilmentService.fulfil()` the webhook uses (`via:
checkout_confirm`). Whichever arrives first wins; the other is a no-op (the conditional pending→paid flip). A mismatch
is refused (409 `session_mismatch` / `amount_mismatch`) and audited as `order.confirm_refused`; another user's order is
a 404. The page polls every 2 s, and after a minute says plainly that the payment reached Stripe and is still being
confirmed (email + Purchase history), then keeps checking every 10 s for up to 15 minutes. Code:
`commerce/webhooks.service.ts` › `confirmCheckout`, tests `commerce/checkout-confirm.spec.ts`, `test/growth.e2e-spec.ts`.

## While Stripe has no keys (production today)
`GET /payments/mode` answers `off`: course pages, the cart and checkout replace Buy / Checkout with "Contact us to enrol"
(`components/TestModeNotice.tsx` › `PaymentsClosed`, linking to `/contact?topic=payment`); DEL can enrol learners through
manual enrollment. With test keys the cart and checkout show the test-mode notice instead.
