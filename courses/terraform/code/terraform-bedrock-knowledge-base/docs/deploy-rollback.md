# Runbook: roll back a bad deployment
1. Stop the rollout: pause the pipeline so nothing else deploys.
2. Find the last good version in the release history (tag or image digest).
3. Redeploy that version through the same pipeline; never by hand on the server.
4. Check health endpoints and error rates for 15 minutes.
5. Open an incident note: what changed, when it was rolled back, the follow-up.
