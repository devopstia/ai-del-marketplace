# Runbook: disk full on a Linux server
1. Confirm: `df -h` shows a filesystem at 90% or more.
2. Find the biggest folders: `sudo du -xh / --max-depth=2 | sort -h | tail -20`.
3. Usual causes: old logs in /var/log (rotate them with logrotate), Docker images (`docker system prune` after checking), core dumps.
4. Never delete database files to free space. Escalate to the on-call DBA instead.
5. After the fix, add an alarm at 80% so it does not happen again.
