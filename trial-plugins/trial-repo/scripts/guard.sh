#!/bin/sh
# Trial PreToolUse guard: log every Bash call and deny any command containing CANARY_REPO.
v=$(cat "${CLAUDE_PLUGIN_ROOT}/scripts/version")
input=$(cat)
echo "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ) PreToolUse trial-repo $v" >> /tmp/plugin-trial.log
case "$input" in
  *CANARY_REPO*) echo "Blocked by plugin trial-repo $v: command contains CANARY_REPO" >&2; exit 2 ;;
esac
exit 0
