import { env } from '../config/env';
import { type Block, layout, type Rendered } from './layout';

/**
 * Every email the marketplace sends (docs/EMAIL.md lists when each one goes out). Templates receive only the data
 * the code passes in the job; no template reads the database. Wording: plain, short, one clear action.
 */
type D = Record<string, unknown>;
const s = (v: unknown, f = '') => (typeof v === 'string' && v ? v : f);
const first = (d: D) => s(d.name, 'there').split(' ')[0]!;
const web = () => env().WEB_URL.replace(/\/$/, '');
const when = (v: unknown) => { const d = v ? new Date(String(v)) : null; return d && !Number.isNaN(+d) ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : ''; };
const usd = (c: unknown) => `$${(Number(c ?? 0) / 100).toFixed(2)}`;
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : s((x as D)?.title))).filter(Boolean) : []);
const courseRows = (v: unknown): [string, string][] => (Array.isArray(v) ? v.map((x) => [s((x as D).title), `until ${when((x as D).expiresAt)}`] as [string, string]) : []);
const mk = (subject: string, blocks: Block[], preheader?: string, why?: string): Rendered => layout({ subject, blocks, preheader, why });
/** The decision text: paragraphs separated by blank lines; single lines inside a paragraph become rows when "Label: value". */
const paras = (v: unknown): Block[] => {
  const t = s(v);
  if (!t) return [];
  return t.split('\n\n').flatMap((para): Block[] => {
    const lines = para.split('\n');
    if (lines.length > 1 && lines.every((l) => /^[^:]{3,40}: .+/.test(l))) return [{ rows: lines.map((l) => { const i = l.indexOf(': '); return [l.slice(0, i), l.slice(i + 2)] as [string, string]; }) }];
    return lines.map((l) => ({ p: l }) as Block);
  });
};
/** The Super Admin's optional extra paragraph for this notification (refund policy settings). */
const extra = (d: D): Block[] => (s(d.extra) ? [{ note: s(d.extra) }] : []);
const refundTerms = (r: unknown) => {
  const o = (r && typeof r === 'object' ? r : {}) as D;
  return o.windowDays != null ? `Refunds within ${Number(o.windowDays)} days if you watched ${Number(o.maxWatchedPercent)}% of a course or less (Access and refunds policy).` : 'Refunds follow the Access and refunds policy.';
};
const STAFF_WHY = 'You receive this because you are a super admin of DevOps Easy Learning. Turn these emails off in Super Admin › Settings.';

export const TEMPLATES: Record<string, (d: D) => Rendered> = {
  // ---------- account ----------
  'verify-email': (d) => mk('Welcome to DevOps Easy Learning: confirm your email', [
    { h1: `Welcome, ${first(d)}` },
    { p: 'Your account is ready. Confirm this email address so receipts, access reminders and password resets reach you.' },
    { cta: { href: s(d.link), label: 'Confirm my email' } },
    { muted: 'The link works once and expires in 3 days. If you didn’t create an account, ignore this email.' },
    { link: s(d.link) },
  ], 'Confirm your email to finish setting up your account'),
  welcome: (d) => mk('Welcome to DevOps Easy Learning', [
    { h1: `Welcome, ${first(d)}` },
    { p: 'Your account is ready. Browse the courses, try the free previews, and pick up where you left off from your Student Studio.' },
    { cta: { href: `${web()}/student`, label: 'Open my Student Studio' } },
  ]),
  'password-reset': (d) => mk('Reset your DevOps Easy Learning password', [
    { h1: 'Reset your password' },
    { p: `Hi ${first(d)}, someone (hopefully you) asked to reset the password of your account.` },
    { cta: { href: s(d.link), label: 'Choose a new password' } },
    { muted: 'The link works once and expires in 1 hour. Resetting signs you out everywhere; Google Authenticator is still asked at sign-in. If you didn’t ask, ignore this email: your password stays the same.' },
    { link: s(d.link) },
  ], 'This link expires in one hour'),
  'security-password-changed': (d) => mk('Your password was changed', [
    { h1: 'Your password was changed' },
    { p: `Hi ${first(d)}, the password of your DevOps Easy Learning account was just changed and every other session was signed out.` },
    { note: 'If this wasn’t you, reset your password now and write to support@devopseasylearning.com.' },
    { cta: { href: `${web()}/forgot-password`, label: 'Reset my password' } },
  ]),
  'security-mfa-reset': (d) => mk('Two-step sign-in was reset on your account', [
    { h1: 'Two-step sign-in was reset' },
    { p: `Hi ${first(d)}, DevOps Easy Learning removed the Google Authenticator from your account after confirming who you are. You set up a new one at your next sign-in.` },
    { note: 'If you didn’t ask for this, write to support@devopseasylearning.com right away.' },
  ]),
  // Email sign-in code (docs/AUTH.md §7): the code is the first thing in the preheader and the email.
  'auth-email-code': (d) => mk(d.purpose === 'confirm' ? `${s(d.code)} is your DevOps Easy Learning confirmation code` : `${s(d.code)} is your DevOps Easy Learning sign-in code`, [
    { h1: d.purpose === 'confirm' ? 'Confirm it’s you' : 'Your sign-in code' },
    { p: `Hi ${first(d)}, enter this code ${d.purpose === 'confirm' ? 'to confirm the change in your account' : 'to finish signing in'}. It works once and expires in ${Number(d.minutes ?? 5)} minutes.` },
    { code: s(d.code) },
    { rows: [['Requested from', s(d.device, 'Unknown device')]] },
    { note: 'If you didn’t try to sign in, ignore this email and change your password: someone may know it. Never share this code, not even with DevOps Easy Learning staff.' },
  ], `${s(d.code)} · expires in ${Number(d.minutes ?? 5)} minutes`),
  'security-new-device': (d) => mk('New sign-in to your DevOps Easy Learning account', [
    { h1: 'New sign-in from a new device' },
    { p: `Hi ${first(d)}, your account was just signed in from a browser or device it hasn’t used before.` },
    { rows: [['When', d.at ? `${new Date(String(d.at)).toUTCString().replace(' GMT', ' UTC')}` : ''], ['Device', s(d.device, 'Unknown device')], ['IP address', s(d.ip, 'not available')], ['Location', 'Location unavailable']] },
    { p: 'If this was you, there is nothing to do.' },
    { note: 'If it wasn’t you: reset your password now (this signs out every device) and write to support@devopseasylearning.com.' },
    { cta: { href: `${web()}/forgot-password`, label: 'Reset my password' } },
  ]),
  'security-account-locked': (d) => mk('Your DevOps Easy Learning account was locked for a few minutes', [
    { h1: 'Too many wrong attempts' },
    { p: `Hi ${first(d)}, someone entered a wrong ${d.what === 'password' ? 'password' : 'code'} for your account several times in a row, so sign-in is paused for ${Number(d.minutes ?? 15)} minutes.` },
    { rows: [['IP address', s(d.ip, 'not available')]] },
    { note: 'If this wasn’t you, reset your password and write to support@devopseasylearning.com. Your two-step sign-in still protects the account.' },
    { cta: { href: `${web()}/forgot-password`, label: 'Reset my password' } },
  ]),
  'security-identity-linked': (d) => mk(`${s(d.provider, 'A sign-in method')} was linked to your account`, [
    { h1: 'New way to sign in' },
    { p: `**${s(d.provider)}** can now be used to sign in to your DevOps Easy Learning account. Google Authenticator is still asked every time.` },
    { note: 'If this wasn’t you, remove it in Account settings › Security and change your password.' },
    { cta: { href: `${web()}/student/account`, label: 'Review my sign-in methods' } },
  ]),
  'security-identity-unlinked': (d) => mk(`${s(d.provider, 'A sign-in method')} was removed from your account`, [
    { h1: 'Sign-in method removed' },
    { p: `**${s(d.provider)}** can no longer be used to sign in to your account.` },
    { cta: { href: `${web()}/student/account`, label: 'Review my sign-in methods' } },
  ]),
  'security-email-changed': (d) => mk('The email address of your account was changed', [
    { h1: 'Your sign-in email changed' },
    { p: `Hi ${first(d)}, DevOps Easy Learning changed the email address of your account to **${s(d.newEmail)}** at your request. From now on, receipts and sign-in emails go there.` },
    { note: 'If you didn’t ask for this, write to support@devopseasylearning.com right away.' },
  ]),
  'security-role-changed': (d) => mk('Your access on DevOps Easy Learning changed', [
    { h1: 'Your access changed' },
    { p: `Hi ${first(d)}, a super admin changed the roles on your account.` },
    { rows: [...(list(d.added).length ? [['Added', list(d.added).join(', ').replace(/_/g, ' ')] as [string, string]] : []), ...(list(d.removed).length ? [['Removed', list(d.removed).join(', ').replace(/_/g, ' ')] as [string, string]] : [])] },
    { note: 'If you didn’t expect this, write to support@devopseasylearning.com.' },
  ]),

  // Super admin support session (docs/SUPPORT_SESSIONS_AND_AGENTS.md): sent when it starts, so the person always knows.
  'security-support-session': (d) => mk('DevOps Easy Learning support opened your dashboard', [
    { h1: 'Support is working in your account' },
    { p: `Hi ${first(d)}, ${s(d.admin, 'a DevOps Easy Learning super admin')} opened your dashboard to help you. They can see what you see, but cannot see or change your password, email or two-step sign-in, and cannot buy or request refunds for you.` },
    { rows: [['Reason', s(d.reason)], ['Started', s(d.startedAt)], ['Ends at the latest', s(d.expiresAt)]] },
    { note: 'If you didn’t ask for help, write to support@devopseasylearning.com. Every action in a support session is recorded.' },
  ], 'A super admin opened your dashboard to help you'),
  'security-agent-access': (d) => mk('An AI assistant can now work on your courses', [
    { h1: 'AI course assistant enabled' },
    { p: `Hi ${first(d)}, ${s(d.admin, 'a DevOps Easy Learning super admin')} gave an AI assistant (“${s(d.agent)}”) access to help build your courses. It can create and edit your draft courses, upload your videos and files, and submit a course for review. It can’t publish, see payments, or touch anyone else’s courses.` },
    { rows: [['Reason', s(d.reason)], ['Access ends', s(d.expiresAt)]] },
    { note: 'Courses stay yours. Ask support@devopseasylearning.com to stop it at any time.' },
    { cta: { href: `${web()}/studio`, label: 'Open my Instructor Studio' } },
  ]),

  // ---------- purchases and access ----------
  'order-receipt': (d) => mk(`Your receipt from DevOps Easy Learning${d.total ? ` (${usd(d.total)})` : ''}`, [
    { h1: `Thanks for your purchase, ${first(d)}` },
    { p: 'Your courses are ready in your Student Studio. Each purchase includes 12 months of access; nothing renews automatically.' },
    { rows: [...(Array.isArray(d.lines) ? (d.lines as D[]).map((l) => [`${s(l.title)}${l.renewal ? ' (renewal)' : ''}`, `${usd(l.priceCents)} · until ${when(l.accessUntil)}`] as [string, string]) : []), ['Total', usd(d.total)]] },
    { cta: { href: `${web()}/student/courses`, label: 'Start learning' } },
    // The receipt number and a link to the receipt (sign-in required; receipts are never public): docs/RECEIPTS.md.
    { muted: `Receipt ${s(d.receiptNumber, s(d.orderId).slice(0, 8))}: view or download it at ${web()}/student/purchases/${s(d.orderId)} (sign in to open it).${d.refund ? ` ${refundTerms(d.refund)}` : ''}` },
  ], 'Your courses are ready'),
  'access-expiring': (d) => mk(`Your access to ${s(d.course)} ends in ${Number(d.daysLeft)} day${Number(d.daysLeft) === 1 ? '' : 's'}`, [
    { h1: 'Your access ends soon' },
    { p: `Hi ${first(d)}, your 12 months of access to **${s(d.course)}** end on **${when(d.expiresAt)}**.` },
    { p: 'Renew for another 12 months at the current price. Your progress, notes and certificate stay as they are. Nothing is charged automatically.' },
    { cta: { href: `${web()}/courses/${s(d.slug)}`, label: 'Renew for 12 months' } },
  ]),
  'access-expired': (d) => mk(`Your access to ${s(d.course)} has ended`, [
    { h1: 'Your access has ended' },
    { p: `Hi ${first(d)}, your 12 months of access to **${s(d.course)}** ended on ${when(d.expiresAt)}. Your progress is saved.` },
    { cta: { href: `${web()}/courses/${s(d.slug)}`, label: 'Renew and continue' } },
  ]),
  'course-access-activated': (d) => mk('Your course is ready', [
    { h1: `Your course is ready, ${first(d)}` },
    { p: 'DevOps Easy Learning added this course to your account:' },
    { rows: courseRows(d.courses) },
    { cta: { href: s(d.link, `${web()}/student/courses`), label: 'Start learning' } },
  ]),
  'courses-assigned': (d) => mk('Your new courses are ready', [
    { h1: `Your courses are ready, ${first(d)}` },
    { p: 'DevOps Easy Learning added these courses to your account. Each has its own access date:' },
    { rows: courseRows(d.courses) },
    { cta: { href: s(d.link, `${web()}/student/courses`), label: 'Open My courses' } },
  ]),
  'course-access-extended': (d) => mk(`Access to ${s(d.course)} extended`, [
    { h1: 'Your access was extended' },
    { p: `Hi ${first(d)}, you now have access to **${s(d.course)}** until **${when(d.expiresAt)}**.` },
    { cta: { href: s(d.link, `${web()}/student/courses`), label: 'Continue learning' } },
  ]),

  // ---------- refunds (owner 2026-11-26: the exact decision, the dates, the measured share and the policy link) ----------
  'refund-received': (d) => mk('We received your refund request', [
    { h1: 'Refund request received' },
    { p: `Hi ${first(d)}, we received your request for: ${list(d.courses).join(', ')}. A member of our team reviews it and emails you the decision.` },
    ...paras(d.message),
    ...extra(d),
    { cta: { href: `${web()}/student/purchases/${s(d.orderId)}`, label: 'See my request' } },
  ]),
  'refund-processing': (d) => mk('Your refund is approved', [
    { h1: 'Your refund is approved' },
    { p: `Hi ${first(d)}, your refund ${d.amountCents != null ? `of **${usd(d.amountCents)}** ` : ''}for ${list(d.courses).join(', ') || 'your course'} is approved and our payment provider is processing it.` },
    { p: 'We’ll email you as soon as the provider confirms it. Until then nothing has been returned to your card yet.' },
    ...extra(d),
  ]),
  'refund-approved': (d) => mk('Your refund is complete', [
    { h1: 'Your refund is complete' },
    { p: `Hi ${first(d)}, we refunded ${d.amountCents != null ? `**${usd(d.amountCents)}** for ` : ''}${list(d.courses).join(', ') || 'your course'}. Our payment provider confirmed it; your bank shows it in 5–10 business days.` },
    ...(s(d.note) ? [{ note: s(d.note) } as Block] : []),
    ...extra(d),
  ]),
  'refund-delayed': (d) => mk('Your refund is approved: payment delayed', [
    { h1: 'Your refund is approved' },
    { p: `Hi ${first(d)}, your refund for ${list(d.courses).join(', ') || 'your course'} is approved, but our payment provider couldn’t process it yet. Our team is retrying; you don’t need to do anything.` },
    { muted: 'Questions? Reply to this email or write to support@devopseasylearning.com.' },
  ]),
  'refund-declined': (d) => mk('About your refund request', [
    { h1: 'Your refund request is not eligible' },
    { p: `Hi ${first(d)}, we checked your request for **${s(d.course, list(d.courses).join(', '))}** against our refund policy.` },
    ...paras(d.message),
    ...(d.message ? [] : [{ rows: [['Purchase date', when(d.purchasedAt)], ['Refund deadline', when(d.deadline)], ['Applicable refund period', `${Number(d.windowDays ?? 0)} days`], ['Your course consumption', `${Number(d.watchedPercent ?? 0)}%`], ['Maximum permitted consumption', `${Number(d.thresholdPercent ?? 0)}%`]] as [string, string][] } as Block]),
    ...extra(d),
    { p: 'If something went wrong (a technical problem, missing content, a payment error), ask for a review from your receipt. A person looks at every review.' },
    { cta: { href: `${web()}/student/purchases/${s(d.orderId)}`, label: 'Ask for a review' } },
    { muted: `Refund policy: ${s(d.policyUrl, `${web()}/policies/access-and-refunds`)} · Support: support@devopseasylearning.com` },
  ]),
  'refund-review-received': (d) => mk('We received your review request', [
    { h1: 'A person will review your request' },
    { p: `Hi ${first(d)}, thanks for explaining. A DevOps Easy Learning team member reviews your refund request and emails you the decision.` },
  ]),
  'refund-declined-after-review': (d) => mk('Your refund review', [
    { h1: 'Your refund review' },
    { p: `Hi ${first(d)}, we reviewed your request and can’t refund it.` },
    ...(s(d.note) ? [{ note: s(d.note) } as Block] : []),
    { muted: `Refund policy: ${web()}/policies/access-and-refunds · Questions? Reply to this email.` },
  ]),

  // ---------- instructors ----------
  'instructor-application-received': (d) => mk('We received your instructor application', [
    { h1: 'Application received' },
    { p: `Thanks, ${first(d)}. DevOps Easy Learning reviews every application, usually within two working days, and emails you the decision.` },
    { cta: { href: s(d.link, `${web()}/student/teach`), label: 'See my application' } },
  ]),
  'instructor-approved': (d) => mk('You’re now an instructor on DevOps Easy Learning', [
    { h1: `Welcome to teaching, ${first(d)}` },
    { p: 'Your application is approved. The Instructor Studio is in your studio switcher; your student account and courses stay as they are.' },
    { list: ['Create a course and add sections and lessons', 'Upload each lesson’s video and its files', 'Submit it for review'] },
    { cta: { href: s(d.link, `${web()}/studio`), label: 'Open the Instructor Studio' } },
  ]),
  'instructor-rejected': (d) => mk('About your instructor application', [
    { h1: 'Your application wasn’t approved' },
    { p: `Hi ${first(d)}, thank you for applying. We can’t approve it at this time. You keep your student account.` },
    ...(s(d.note) ? [{ note: s(d.note) } as Block] : []),
    { cta: { href: s(d.link, `${web()}/student/teach`), label: 'Update and apply again' } },
  ]),
  'instructor-needs-info': (d) => mk('A question about your instructor application', [
    { h1: 'We need a little more information' },
    { p: `Hi ${first(d)}, to finish reviewing your application:` },
    { note: s(d.note) },
    { cta: { href: s(d.link, `${web()}/student/teach`), label: 'Update my application' } },
  ]),

  // ---------- manual enrollment ----------
  'student-invitation': (d) => mk('DevOps Easy Learning invited you to your courses', [
    { h1: `Your courses are waiting, ${first(d)}` },
    { p: 'DevOps Easy Learning enrolled you in:' },
    { rows: courseRows(d.courses) },
    { p: 'Create your account: we send a code to this address to confirm it’s you, you choose your own password, then you set up Google Authenticator.' },
    { cta: { href: s(d.link), label: 'Create my account' } },
    { muted: `This invitation expires in ${Number(d.expiresInDays ?? 7)} days and works once. If you didn’t expect it, ignore this email.` },
    { link: s(d.link) },
  ], 'Create your account to start learning'),
  'invitation-code': (d) => mk(`${s(d.code)} is your DevOps Easy Learning code`, [
    { h1: 'Your confirmation code' },
    { p: `Hi ${first(d)}, enter this code on the invitation page:` },
    { code: s(d.code) },
    { muted: 'It expires in 15 minutes. Never share it: DevOps Easy Learning will never ask you for it.' },
  ], 'Valid for 15 minutes'),
  'manual-enrollment-request-received': (d) => mk(`Request ${s(d.ref)} sent to DevOps Easy Learning`, [
    { h1: 'Enrollment request sent' },
    { p: `Your request **${s(d.ref)}** for **${s(d.student)}** (${list(d.courses).join(', ')}) is waiting for DevOps Easy Learning. We verify the payment, then approve it and invite the student.` },
    { cta: { href: s(d.link), label: 'See my requests' } },
  ]),
  'manual-enrollment-submitted': (d) => mk(`New manual enrollment request ${s(d.ref)}`, [
    { h1: 'Manual enrollment to review' },
    { rows: [['Request', s(d.ref)], ['Instructor', s(d.instructor)], ['Student', s(d.student)], ['Courses', list(d.courses).join(', ')]] },
    { p: 'Verify the payment (or record a complimentary reason), then approve.' },
    { cta: { href: s(d.link), label: 'Review the request' } },
  ], undefined, STAFF_WHY),
  'manual-enrollment-approved': (d) => mk(`Request ${s(d.ref)} approved`, [
    { h1: 'Enrollment approved' },
    { p: `**${s(d.student)}** now has access (or an invitation to create the account). You can copy or resend the invitation from your requests.` },
    { cta: { href: s(d.link), label: 'Open my requests' } },
  ]),
  'manual-enrollment-rejected': (d) => mk(`Request ${s(d.ref)} was not approved`, [
    { h1: 'Enrollment not approved' },
    { p: `Your request for **${s(d.student)}** wasn’t approved.` },
    { note: s(d.note) },
    { cta: { href: s(d.link), label: 'Open my requests' } },
  ]),
  'manual-enrollment-needs-info': (d) => mk(`Request ${s(d.ref)}: more information needed`, [
    { h1: 'DevOps Easy Learning has a question' },
    { p: `About your request for **${s(d.student)}**:` },
    { note: s(d.note) },
    { cta: { href: s(d.link), label: 'Answer' } },
  ]),

  // ---------- staff ----------
  'staff-new-registration': (d) => mk(`New registration: ${s(d.name)}`, [
    { h1: 'New student registered' },
    { rows: [['Name', s(d.name)], ['Signed up with', s(d.method)]] },
    { cta: { href: s(d.link), label: 'Open Users and roles' } },
  ], undefined, STAFF_WHY),
  'staff-instructor-application': (d) => mk(`Instructor application: ${s(d.name)}`, [
    { h1: 'New instructor application' },
    { rows: [['Applicant', s(d.name)], ...(s(d.headline) ? [['Headline', s(d.headline)] as [string, string]] : [])] },
    { cta: { href: s(d.link), label: 'Review the application' } },
  ], undefined, STAFF_WHY),

  // ---------- support and contact ----------
  'support-reply': (d) => mk(`New reply on ${s(d.ticket)}: ${s(d.subject)}`, [
    { h1: 'Support replied to your request' },
    { p: `**${s(d.ticket)}**: ${s(d.subject)}` },
    { cta: { href: `${web()}/support`, label: 'Read the reply' } },
  ]),
  'support-info-requested': (d) => mk(`We need more information on ${s(d.ticket)}`, [
    { h1: 'Support needs a little more information' },
    { p: `**${s(d.ticket)}**: ${s(d.subject)}` },
    { cta: { href: `${web()}/support`, label: 'Answer' } },
  ]),
  'support-resolved': (d) => mk(`${s(d.ticket)} is resolved`, [
    { h1: 'Your request is resolved' },
    { p: `**${s(d.ticket)}**: ${s(d.subject)}. If anything is still wrong, reply in the request and it opens again.` },
    { cta: { href: `${web()}/support`, label: 'See the request' } },
  ]),
  'contact-message': (d) => mk(`[${s(d.ref)}] ${s(d.subject)}`, [
    { h1: s(d.subject) },
    { rows: [['From', `${s(d.name)} <${s(d.email)}>`], ['Subject', s(d.subject)], ['Topic', s(d.topic)], ['Reference', s(d.ref)], ['Signed in', d.signedIn ? 'yes' : 'no']] },
    { p: s(d.body) },
    { muted: 'Screenshots, if any, are attached. Reply to this email to answer the sender directly.' },
    { cta: { href: s(d.link), label: 'Open Contact messages' } },
  ], undefined, 'Sent from the Contact page of the DevOps Easy Learning marketplace.'),
  'contact-received': (d) => mk(`We received your message (${s(d.ref)})`, [
    { h1: `Thanks, ${first(d)}. We received your message.` },
    { p: 'Our support team will review it and reply to this email address, usually within one working day.' },
    { rows: [['Reference', s(d.ref)], ['Subject', s(d.subject)], ...(s(d.topic) ? [['Topic', s(d.topic)] as [string, string]] : [])] },
    { note: 'To add details or screenshots, reply to this email and keep the reference in the subject.' },
  ], `Reference ${s(d.ref)}: our support team will review your message.`, 'You receive this because you wrote to DevOps Easy Learning from the Contact page.'),
  'support-ticket-received': (d) => mk(`We received your support request (${s(d.ticket)})`, [
    { h1: `Thanks, ${first(d)}. Your request is with our support team.` },
    { p: 'We review every request and reply in your Help and support page; you also get an email when we answer.' },
    { rows: [['Request', s(d.ticket)], ['Subject', s(d.subject)], ['Category', s(d.category)]] },
    { cta: { href: `${web()}/support`, label: 'Open my request' } },
  ], `Request ${s(d.ticket)}: our support team will review it.`),
  'support-ticket-new': (d) => mk(`[${s(d.ticket)}] ${s(d.subject)}`, [
    { h1: 'New support request' },
    { rows: [['From', `${s(d.name)} <${s(d.email)}>`], ['Subject', s(d.subject)], ['Request', s(d.ticket)], ['Category', s(d.category)], ['Priority', s(d.priority)]] },
    { p: s(d.body) },
    { cta: { href: s(d.link), label: 'Open the support queue' } },
  ], undefined, 'Sent to the DevOps Easy Learning support inbox when a learner opens a support request.'),
};

export function render(template: string, data: D = {}): Rendered | null {
  const fn = TEMPLATES[template];
  return fn ? fn(data) : null;
}
