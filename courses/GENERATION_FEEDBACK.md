# Feedback for the course generation agent

Content problems the Course Upload and Publishing Agent found while uploading. The generation agent should fix them in
the source folders (or say why they're intended); the upload agent re-runs the plan afterwards. Newest first.

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
