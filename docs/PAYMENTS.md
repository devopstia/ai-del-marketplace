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
