# Support Center

In-app help requests (owner, 2026-11-25; adapted from the Insurance Knowledge Hub). Code: `apps/api/src/support/`,
`apps/web/src/app/(site)/support/`, `apps/web/src/app/admin/support/`, `components/support/shared.tsx`.

## For students and instructors (`/support`)
- **Help and support** lists your requests; **New request**: topic, subject (5–160), description (10–5,000), optional course
  and order, up to 3 private files (PNG, JPG, WebP, PDF, 5 MB each). The browser adds browser, OS, page, screen, language and
  whether it is the installed app; only staff see it. At most 5 new requests an hour.
- Found in: account menu, phone menu, footer, studio menu, and **Get help with this order** on every receipt.
- Numbers look like `SUP-000123`. Messages are plain text (never HTML). Staff replies show as **DEL Support**.

## Statuses (moved on the server only)
| event | from | to |
|---|---|---|
| open | | new |
| staff reply | new | open |
| staff asks for information | any open | waiting_user |
| requester reply | new / waiting_user / resolved | open (new stays new) |
| staff resolves (requester emailed, asked to confirm) | any open | resolved |
| requester "Yes, it's solved" / "I still need help" | resolved | closed / open |
| 7 days resolved without a reply (checked on every read) | resolved | closed |
| requester reopens within 30 days, with a note | closed | open |
| only a super admin closes directly | any | closed |

## For staff (`/admin/support`)
Queue with status tabs and counts, Assigned to me / Unassigned, search by number, subject or person; most urgent first,
then the longest waiting. A ticket shows the conversation, **internal notes** (amber, staff only), context, and controls for
priority, topic and assignee. Composer: Reply, Ask for information, Resolve, Internal note. The admin menu shows a badge
with requests waiting for staff. Every staff action is in the audit log; emails are queued to the requester
(`support-reply`, `support-info-requested`, `support-resolved`).

## Security
Only the requester and admins can read a ticket or its files; anyone else gets 404. Files live under
`support/<uploaderId>/` in private storage, uploaded with a 15-minute link and served through the API to readers only.
