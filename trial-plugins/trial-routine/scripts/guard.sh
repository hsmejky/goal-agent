#!/bin/sh
# Trial PreToolUse guard: log every Bash call and deny any command containing CANARY_ROUTINE.
v=$(cat "${CLAUDE_PLUGIN_ROOT}/scripts/version")
input=$(cat)
echo "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ) PreToolUse trial-routine $v" >> /tmp/plugin-trial.log
case "$input" in
  *CANARY_ROUTINE*) echo "Blocked by plugin trial-routine $v: command contains CANARY_ROUTINE" >&2; exit 2 ;;
esac
exit 0
