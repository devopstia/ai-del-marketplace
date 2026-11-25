# video-academy: help video production for DEL

Short scripts in `tutorials/` become narrated help videos recorded on the local site, then published to /help.
Read **docs/HELP_VIDEOS.md** (repo root) first. Ported from the Insurance Knowledge Hub's engine (2026-11-25).

```bash
node cli.mjs list                                 # the plan and what is built
node cli.mjs build find-a-course                  # one video, end to end
node cli.mjs build get-help --from record --only s03   # re-record one scene
node tools/publish-help.mjs --dry-run             # what would be published
node tools/publish-help.mjs --publish             # publish every built video to the LOCAL site
node cli.mjs inventory                            # docs/DEL_HELP_VIDEO_INVENTORY.md
```
