# Sign-in, two-step sign-in and passwords (owner 2026-11-25)

Owner's goal: "registration extremely easy, but account access must remain secure." Code: `apps/api/src/auth/`
(`signin.service.ts` the two steps, `oauth.service.ts` + `oauth.providers.ts` social sign-in, `password-policy.ts`,
`totp.ts`), `apps/web/src/components/auth/`, `app/(site)/login/verify`, `forgot-password`, `reset-password`, Account › Security.

**Review of the Insurance Knowledge Hub (2026-11-25).** It has **no Google sign-in** (email + password, passkeys and
Google Authenticator only). Ported from it: RFC 6238 codes with single-use steps, ten hashed recovery codes, the
5-minute single-use ticket between the steps, wrong-code limits, the lockout that refuses the right password too,
the Super Admin reset (never one's own) and the server-shell last resort. New here: Google, GitHub, Facebook,
LinkedIn, the compromised-password check, trusted devices, account linking.

## 1. Ways to sign in or sign up
| Method | How | New account? |
|---|---|---|
| Email and password | `/register`, `/login` | yes, with the password rules below |
| Google | OpenID Connect, PKCE | yes, if Google says the email is verified |
| GitHub | OAuth 2, PKCE; primary **verified** email from `/user/emails` | yes |
| Facebook | OAuth 2 (Graph v19), PKCE; Facebook only returns a confirmed email | yes |
| LinkedIn | "Sign In with LinkedIn using OpenID Connect" | yes, if `email_verified` |
| Test provider | development only (`OAUTH_TEST_PROVIDER=true`, refused in production) | for QA |

- A provider's button appears **only when its two keys are set**; otherwise its routes answer 404 (rule 4: no dead buttons).
- `state` (one-time) and the PKCE verifier live in a sealed, 10-minute httpOnly cookie; the callback checks both.
- Accounts are matched by the provider's **own account id** (`auth_identities.provider + subject`), never by email.

## 2. Two-step sign-in (Google Authenticator, or email codes for students and instructors: §7), for everyone
Every method only earns a **ticket** (httpOnly `del_mfa` cookie, SHA-256 at rest, 5 minutes to verify / 20 to set up,
single use, burnt after 5 wrong codes). The session cookie is set only after a code.
- **New accounts** (any method) set up Google Authenticator on `/login/verify`: QR (drawn in the browser; the seed never
  goes to a QR service) or the setup key, then a first code, then **ten recovery codes** (shown once, copy/download,
  "I've saved them" before continuing).
- **Codes:** SHA-1, 30 s, 6 digits, ±1 step; a used step is never accepted again (also across sign-ins). Seeds are
  sealed with AES-256-GCM under a key derived from `SESSION_SECRET` (rotating it invalidates seeds: people use a
  recovery code and set up again).
- **Trust this device for 30 days** (owner's choice): optional tick; httpOnly `del_trust` cookie, SHA-256 at rest,
  bound to the account. Ended by a password change or reset, an MFA reset, a new phone, or "Forget all".
- **Recovery code** instead of a code: once each. **Lost everything:** a Super Admin uses Admin › Users ›
  *Reset 2-step* (audited, signs the person out, never their own account); for the only Super Admin:
  `docker compose exec api node dist/auth/mfa-admin.js reset <email>` (audited as `server-shell`).
- **Account › Security:** status, *Move to a new phone* (needs a code from the old app, then one from the new), *Get
  new recovery codes* (needs a code), trusted devices, ways to log in.
- All existing sessions were ended by the migration (2026-11-25) so everyone signs in again with a code.

## 3. Passwords
- Rules (shown live on the form): at least 12 characters (max 128), letters and numbers, not containing the email name
  or the person's name, and **not in a data breach**: Have I Been Pwned's range API (k-anonymity: only the first
  5 hex characters of the SHA-1 are sent), 2.5 s timeout, fails open (the other rules still apply), plus a small
  offline list. `PASSWORD_BREACH_CHECK=false` turns the online check off.
- Stored with argon2id (19 MiB, t=2), rehashed on sign-in when the parameters change.
- **Lockout:** 5 wrong passwords or codes in a row → 15 minutes; the right password is refused while locked. Plus the
  per-IP limit (`AUTH_RATE_LIMIT` a minute).
- **Forgot password:** same answer for every address; link 1 hour, single use (a new link burns old ones), max 3 an
  hour; a reset ends every session and trusted device and clears the lockout; the code is still asked at sign-in.
- **No password needed** for social accounts. *Set a password* in Account › Security (needs a code) adds email login.
- Changing a password signs out every other device. Security emails: password changed, provider linked/unlinked, MFA reset.

## 4. Linking accounts (no duplicates, no silent merges)
- Signed in, Account › Security › **Link** sends you through the provider; the identity is attached to *this* account.
- A provider account already linked to someone else: refused (`identity_in_use`).
- A **new** provider account whose email already has a DEL account: **refused** (`email_exists`), with the advice to
  log in the usual way and link from Account › Security. This blocks someone who creates a provider account with your
  address from reaching your courses.
- **Unlink** needs a code and is refused when it would leave no way in (no password and no other provider).
- Courses, purchases, progress and roles stay on the one account, whatever the method.

## 5. Provider setup (owner, when ready)
Production: **Super Admin › Platform › Sign-in methods** (`/admin/sign-in`) shows each provider's exact redirect URI and
console link. Paste the client ID and secret with an authenticator code: the API checks them with the provider, stores them
sealed (`platform_settings.oauth_config`), never returns the secret, audits the change, and the button appears at once.
Privacy policy URL for the consent screens: `https://ai-devopseasylearning.com/policies/privacy` (it also gives the
data-deletion instructions Facebook asks for); terms: `/policies/terms`. Keys in `.env` still work (shown as "server settings").

Callback URL for each: `<API_URL>/api/auth/oauth/<provider>/callback` (local: `http://127.0.0.1:4000/api/auth/oauth/google/callback`).
| Provider | Where | Notes |
|---|---|---|
| Google | Google Cloud Console › APIs & Services › Credentials › OAuth client ID (Web) | Consent screen: scopes `openid email profile` (non-sensitive, no Google review). Publish the app ("In production") or only test users can sign in. |
| GitHub | Settings › Developer settings › OAuth Apps › New | One callback URL per app: create one for local and one for production. No review. |
| Facebook | developers.facebook.com › Create app › "Authenticate and request data from users with Facebook Login" | **Business verification and App Review** are needed before the public can use it (`email`, `public_profile`); Live mode, privacy policy URL and data deletion URL required. |
| LinkedIn | linkedin.com/developers › Create app › Products › **Sign In with LinkedIn using OpenID Connect** | Needs a LinkedIn **Company Page** to verify the app; the product is approved automatically after verification. No PKCE for web apps (client secret is used). |

Locally you can instead set `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_…`, `FACEBOOK_…`, `LINKEDIN_…` and restart api. Production: never set
`OAUTH_TEST_PROVIDER`.

## 6. Local development and tests
- Demo accounts share the authenticator seed `SEED_MFA_SECRET` in `.env` (make-env.sh makes one; `node
  dist/auth/mfa-admin.js demo` applies it). Add it to your phone with "Enter a setup key", or `node scripts/totp.mjs`
  prints the current code. Never used in production.
- `scripts/totp.mjs` is used by the smoke test, `qa-dark.mjs`, `demo-catalogue.sh` and the video engine; Playwright's
  `login()` enters a code once per account and reuses "Trust this device".
- Tests: `apps/api/src/auth/auth-security.spec.ts` (RFC 6238 vectors, breach check, each provider's response) and the
  e2e "sign-in security" suite (codes, recovery, trust, lockout, reset, social, linking, Super Admin reset).

## 7. Email sign-in codes and session security (owner 2026-11-26, prompts.md)
**Review before the change (what existed, what was missing).** Existing and reused: password + four providers, the
single-use sign-in ticket, Google Authenticator (TOTP, single-use steps), ten hashed recovery codes, trusted devices,
lockout after 5 failures, step-up codes for sensitive changes, cookie sessions hashed at rest, "sign out other devices"
on a password change, per-IP rate limits, signed short-lived playback sessions. Missing: a second step without a
smartphone (email codes), central settings, an inactivity timeout, a maximum session lifetime (sessions lasted 30 days),
a one-browser rule, telling a disconnected browser why, a Super Admin view of a person's sessions, new-device and
lockout emails, and (a bug) signing in again revoked the browser's current session *before* the new code was checked.
Government ID verification: not offered (owner, 2026-11-26).

**Email codes** (`signin.service.ts` `sendEmailCode`, `complete({ emailCode })`): for **students and instructors only**
when allowed (Super Admin setting, per role). An email code proves access to the inbox, not who someone is, so it is
never enough for Admin or Super Admin: `allowedMethods()` refuses it for any account with a privileged role, and the
settings schema can't list those roles. Code: N digits (6–8) from `crypto.randomInt`, stored only as an HMAC
(SESSION_SECRET) bound to the sign-in ticket, single use, expires (5 min), limited wrong tries (5) per code, 60 s resend
cooldown, at most 5 codes per sign-in attempt, a new code replaces the old one, the email is masked on screen, the code
never appears in logs or the audit (only "sent"). A successful email-code sign-in marks the email verified. "Trust this
browser" isn't offered with an email code. People without an authenticator see "Send a code to my email" on the setup
screen (stage `enroll`); next time the screen starts on the email code (`prefers`). Sensitive changes for them use
`POST /auth/step-up/email` (same rules, bound to the account); they can add Google Authenticator from Account › Security.

**Settings** (`auth/security-settings.ts`, `common/session-policy.service.ts`, page `/admin/security`): stored in
`platform_settings.auth_security`, cached 15 s per API process (refreshed at once on save), step-up code to change,
audited with the changed fields, "Restore recommended settings". Defaults = the owner's table: email codes on for
students and instructors, 6 digits, 5 min, 5 tries, 60 s; inactivity 30 min, warning 2 min, lifetime 24 h, one browser,
end the older session; new-device and lockout emails on. Recovery codes are always on (they come with the authenticator).

**Sessions** (`auth.guard.ts`, `SessionPolicyService`):
- `sessions.kind`: `user` = an ordinary sign-in; `support` = a super admin support session (impersonation, built
  separately). **Contract:** create support sessions with `SignInService.createSession(userId, ctx, { kind: 'support',
  ttlMs })`; they don't count toward the person's limit, never end the person's sessions, and aren't subject to the
  ordinary idle/lifetime rule (their own `expiresAt` applies). AI agents use scoped tokens, never sessions.
- Lifetime and inactivity are checked by the guard on every request. Activity = the heartbeat (`POST
  /auth/session/heartbeat`, sent by `components/SessionGuard.tsx` at most once a minute while the person types, clicks,
  scrolls or a lesson plays) and video progress saves; background polling never counts.
- One browser (or "at most N"): when a sign-in completes **every** step, older `user` sessions over the limit end as
  `replaced` (oldest first), or with "refuse" the new sign-in gets 409 `session_limit` before its ticket is used. A
  failed code never disconnects anyone. Tabs of one browser share the cookie and keep working.
- Every end goes through `SessionPolicyService.end()`: `endedReason` (logout, replaced, idle, lifetime, admin, user),
  an audit entry, and the person's video playback sessions expire at once (encryption key and playlists stop; segment
  links already handed out expire with their short signature).
- The ended browser gets 401 `session_<reason>` with a clear message (the owner's wording for "replaced"); `/auth/me`
  reports it once and clears the dead cookie; the sign-in page shows the message.
- Browser warning: `SessionGuard` shows "Are you still there?" with a countdown `warningMinutes` before the timeout,
  "Stay signed in" / "Sign out now"; the newest activity of any tab counts (localStorage).
- New device: a long-lived random `del_dev` cookie (stored as sha256 on the session). The first sign-in from a browser
  an account never used (not the very first sign-in of the account) emails the owner: time, device (from the user
  agent), IP, "Location unavailable" (no geo-IP service is used).
- Super Admin › Users › a person › Sessions: live sessions (device, IP, signed in, last active, end time), recent
  sign-ins and session ends from the audit log, "Sign out" one or everywhere (audited; viewing is audited too).

**Tests and test stacks.** `AUTH_SESSION_LIMITS=off` (ignored in production) relaxes only the *defaults* (no one-browser
rule, 8 h idle) so parallel browser tests can sign the same demo account in several times: set in
`docker-compose.test.yml` and the jest setup. Saved settings still apply. The owner's local site and staging use the real
defaults (signing in on a second browser signs the first out). `apps/api/test/auth-sessions.e2e-spec.ts` covers email
codes, the admin safeguard, one-browser, refuse mode, inactivity, lifetime, Super Admin session control, security
emails and step-up by email; `src/auth/security-settings.spec.ts` and `src/common/guards.spec.ts` the rules.
