#!/usr/bin/env bash
# Sign in to the marketplace for the course publisher's session mode (owner 2026-11-27: "Please do not use agents").
# Run it yourself in Claude Code with "!" so the password and code never appear in the conversation:
#
#   ! scripts/del-signin.sh [https://ai-devopseasylearning.com] <cookie-jar-path>
#   ! scripts/del-signin.sh --logout [site] <cookie-jar-path>      (sign out and delete the jar)
#
# It asks for your email, password (hidden) and the 6-digit Google Authenticator code, goes through the real sign-in
# (password, then the code; docs/AUTH.md) and writes ONLY the session cookie jar (mode 600). The password and the code
# are never stored, printed or passed on a command line. One signed-in browser per account: signing in here ends your
# other browser session (sign in there again afterwards).
set -euo pipefail
umask 077

logout=0
if [[ "${1:-}" == "--logout" ]]; then logout=1; shift; fi
if [[ $# -eq 1 ]]; then site="https://ai-devopseasylearning.com"; jar="$1"; else site="${1:-https://ai-devopseasylearning.com}"; jar="${2:-}"; fi
[[ -n "$jar" ]] || { echo "Usage: $0 [--logout] [site] <cookie-jar-path>" >&2; exit 2; }
api="${site%/}/api"
csrf() { awk '$6=="csrf"{v=$7} END{print v}' "$jar"; }
msg() { python3 -c 'import json,sys
try:
  d=json.load(sys.stdin); e=d.get("error",d); print(e.get("message") or e.get("code") or d)
except Exception: print("unexpected answer from the server")'; }

if (( logout )); then
  if [[ -f "$jar" ]]; then
    curl -s -o /dev/null -b "$jar" -c "$jar" -H "x-csrf-token: $(csrf)" -X POST "$api/auth/logout" || true
    rm -f "$jar"
  fi
  echo "signed out; session file deleted"
  exit 0
fi

echo "Signing in to $site. This ends your other signed-in browser session (one session per account)."
read -r -p "Email [support@devopseasylearning.com]: " email
email="${email:-support@devopseasylearning.com}"
read -r -s -p "Password: " pw; echo

rm -f "$jar"; : > "$jar"
curl -s -o /dev/null -b "$jar" -c "$jar" "$api/auth/csrf"
out=$(printf '%s\0%s' "$email" "$pw" | python3 -c 'import json,sys; e,p=sys.stdin.read().split("\0",1); print(json.dumps({"email":e,"password":p}))' \
  | curl -s -b "$jar" -c "$jar" -H "x-csrf-token: $(csrf)" -H 'content-type: application/json' --data-binary @- -w '\n%{http_code}' "$api/auth/login")
unset pw
code=${out##*$'\n'}; body=${out%$'\n'*}
if [[ "$code" != 200 ]]; then echo "Sign-in failed: $(printf '%s' "$body" | msg)"; rm -f "$jar"; exit 1; fi
stage=$(printf '%s' "$body" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("mfa") or "")')
if [[ "$stage" == "enroll" ]]; then echo "This account has no authenticator yet: set it up in the browser first."; rm -f "$jar"; exit 1; fi
if [[ "$stage" == "verify" ]]; then
  read -r -p "6-digit authenticator code: " otp
  out=$(printf '%s' "$otp" | python3 -c 'import json,sys; print(json.dumps({"code":sys.stdin.read().strip()}))' \
    | curl -s -b "$jar" -c "$jar" -H "x-csrf-token: $(csrf)" -H 'content-type: application/json' --data-binary @- -w '\n%{http_code}' "$api/auth/mfa/complete")
  unset otp
  code=${out##*$'\n'}; body=${out%$'\n'*}
  if [[ "$code" != 200 ]]; then echo "Code not accepted: $(printf '%s' "$body" | msg)"; rm -f "$jar"; exit 1; fi
fi
name=$(curl -s -b "$jar" -c "$jar" "$api/auth/me" | python3 -c 'import json,sys; u=(json.load(sys.stdin) or {}).get("user") or {}; print(u.get("name","") + (" (super admin)" if "super_admin" in u.get("roles",[]) else ""))')
[[ -n "$name" ]] || { echo "Sign-in did not create a session."; rm -f "$jar"; exit 1; }
echo "signed in as $name; session saved to $jar"
