// The hook command for the Home repo's .claude/settings.json. It extracts scripts/ (the pinned copy
// of scripts/guard, scripts/gate and scripts/home, laid out as in goal-agent) from origin/main
// (never the working tree, R45) and runs the guard from there. Any failure exits 2, which blocks
// the tool call. Outside cloud sessions (CLAUDE_CODE_REMOTE not "true", R45) it exits 0 first, so a
// local clone whose origin/main has no scripts/ yet, or without bash tooling, is never blocked.
export function hookCommand(mode) {
  const chain = [
    `d=$(mktemp -d) && trap 'rm -rf "$d"' EXIT`,
    `git archive origin/main scripts | tar -x -C "$d"`,
    `node "$d/scripts/guard/guard.mjs" ${mode}`,
  ].join(" && ") + " || exit 2";
  return `[ "$CLAUDE_CODE_REMOTE" = true ] || exit 0; ${chain}`;
}

/** The `hooks` block for settings.json. */
export function hookSettings() {
  const entry = (mode) => [{ hooks: [{ type: "command", command: hookCommand(mode) }] }];
  return { hooks: { SessionStart: entry("session-start"), PreToolUse: entry("pre-tool-use") } };
}
