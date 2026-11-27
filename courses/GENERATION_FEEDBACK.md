# Feedback for the course generation agent

Content problems the Course Upload and Publishing Agent found while uploading. The generation agent should fix them in
the source folders (or say why they're intended); the upload agent re-runs the plan afterwards. Newest first.

## 2026-11-26 (later): AI coverage, lesson 18, quizzes, manifest
The owner renamed the course **AI-Powered DevOps Automation with n8n** and wants it to teach AI-powered DevOps
automation in depth. Today only **lesson 17** is about AI (AI summaries of failed deployments, an error explainer, an
incident summary and an AI morning report, with OpenAI: redaction, prompt injection, labelled drafts, token costs, a human
reviews). The description claims only that. To earn the title, please create these lessons (each one video, captions,
slides PDF, lab ZIP and a 4-question quiz with spoken options; folder numbers in the order a learner should watch them):

| Suggested lesson | Outline | Lab |
|---|---|---|
| GitHub pull request notifications | GitHub webhook (signed, `X-Hub-Signature-256`) → n8n → Mattermost: opened, review requested, merged; one message per PR updated in place | a test repo + workflow JSON + a script that sends sample PR events |
| AI pull request review assistant | fetch the PR diff, redact, ask the model for risks and a checklist, post it as a PR comment labelled "AI draft"; the human reviewer decides; limits on diff size and cost | workflow + sample diffs (one with a planted prompt injection) |
| Slack integration | the same notifications in Slack (incoming webhook and bot token, Block Kit), and how to support Slack and Mattermost from one workflow | workflow with a channel switch, a Slack sandbox guide |
| AI agents in n8n | n8n's AI Agent node with tools (read-only HTTP checks, a runbook lookup), memory, max iterations, human approval before any action | workflow + a mock service API + runbooks |
| AI incident triage and root-cause suggestions | correlate alerts, recent deployments and logs, then ask the model for ranked hypotheses with evidence; the on-call engineer confirms | Alertmanager-shaped events + deployment history + logs |
| AI in CI/CD | explain a failed pipeline from its log, suggest the fix, flag a risky change before deploy; never auto-merge or auto-deploy | GitHub Actions example + failing sample runs |
| Intelligent alerting | noise reduction: group, de-duplicate, score urgency with rules first and AI second, a daily "what was noisy" summary | sample alert flood + workflow |
| Course introduction (`00-…`) | 2–3 min: who it's for, what you'll build, the tools, how labs work | none (role `intro`) |

**Lesson 18 arrived** (`18-n18-n8n-cloud-vm-live`, 15 min 55 s, the same lab on an AWS EC2 VM with Terraform): placed at
the **end of section 1** ("Getting started"), after the n8n tour, because it runs the same stack and is optional for the
rest of the course. Its folder number (18) doesn't match where it belongs; for new lessons, number the folder by the
intended position, or set `position` in `lesson.json`.

**Quizzes:** lessons 04–18 read the options aloud ("A: …; B: …; or C: …?"), so their 4 questions are imported
automatically as a "Check your understanding" quiz after the video. **Lessons 01, 02 and 03 say "Pause and think" and the
options are only on the slide images**: their 12 questions can't be imported (options are never invented). Fix: read
the options aloud as in the later lessons, or put the quiz in `lesson.json` (below); it is used only when every answer
matches the one the video says ("The answer is B: …").

**Manifest (please write one per course):** `course.manifest.json` in the course folder, optionally `lesson.json` per
lesson folder. Schema: `courses/manifest.schema.json`. The upload agent treats it as hints and checks them against the
captions, slides and lab. Example:
```json
{
  "version": 1,
  "course": { "title": "AI-Powered DevOps Automation with n8n",
              "sections": [{ "title": "Getting started: n8n and Mattermost", "lessons": ["00-intro", "01-n1-n8n-mattermost-explained"] }] },
  "lessons": [
    { "folder": "00-intro", "role": "intro", "status": "ready", "title": "Welcome: what you'll build",
      "description": "Who this course is for, the projects you'll build and how the labs work.", "position": { "section": 0, "order": 0 } },
    { "folder": "19-n19-github-pr-notifications-live", "role": "lesson", "status": "ready",
      "title": "GitHub pull request notifications", "description": "Signed GitHub webhooks to n8n, one Mattermost message per PR.",
      "objectives": ["Verify X-Hub-Signature-256 in n8n"], "prerequisites": ["06-n6-n8n-deploy-notifications-live"],
      "position": { "section": "DevOps automations in practice", "after": "08-nt2-automation-chatops-words" },
      "resources": ["19-n19-github-pr-notifications-live-presentation.pdf", "19-n19-github-pr-notifications-live-lab.zip"],
      "quiz": [{ "q": "What proves a webhook came from GitHub?", "options": ["Its IP address", "The X-Hub-Signature-256 HMAC", "The User-Agent"], "correct": 1,
                 "why": "Only someone with the secret can compute the HMAC." }] }
  ]
}
```

## 2026-11-26: DevOps Automation with n8n (`18-automation-n8n`)
- **Lessons that promise a lab but have none.** `01-n1-n8n-mattermost-explained` ends with "Download the lab and practise:
  host both tools…" and `07-n5-n8n-errors-retries-debugging-live` ends with "Download the lab, flip the fault switch…",
  but neither folder has a `*-lab.zip`. Either add the lab (07 clearly needs its fault-switch API) or change the closing
  line. 05 and 08 (vocabulary lessons) correctly say "keep this glossary handy".
- **Numbering gaps.** Folders 09, 11 and 14 are missing (internal codes n7, n8, n9, n11, n14 too). The owner says more n8n
  videos are coming; name new folders so they sort where a learner should watch them.
- **Folder order and lesson codes differ.** `06-n6-…` comes before `07-n5-…`. The folder order was used (deployment
  notifications before errors and retries), which reads well; keep folder numbers = intended order.
- **Labs 02, 03, 04 and 06 are the same `n8n-mattermost` project at different stages** (later ones add scripts). Fine,
  but say in each README which lesson it belongs to (they do) and keep later labs complete on their own.
- Good: one MP4 (1080p H.264/AAC), English SRT captions, a PDF next to every PPTX, READMEs with hardware, cost and
  "stop the VM" notes, `.env.example` only, demo secrets clearly fake (`not-a-real-key`).
