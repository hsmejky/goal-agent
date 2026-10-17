#!/bin/sh
# Trial SessionStart hook: leave a timestamped marker and tell the session this plugin loaded.
v=$(cat "${CLAUDE_PLUGIN_ROOT}/scripts/version")
echo "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ) SessionStart trial-routine $v root=${CLAUDE_PLUGIN_ROOT}" >> /tmp/plugin-trial.log
echo "Plugin trial-routine $v SessionStart hook ran."
