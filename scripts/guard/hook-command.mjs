// The hook command for the Home repo's .claude/settings.json. It extracts .claude/hooks/ from
// origin/main (never the working tree, R45) and runs the guard from there. Any failure exits 2,
// which blocks the tool call.
export function hookCommand(mode) {
  return [
    `d=$(mktemp -d) && trap 'rm -rf "$d"' EXIT`,
    `git archive origin/main .claude/hooks | tar -x -C "$d"`,
    `node "$d/.claude/hooks/guard.mjs" ${mode}`,
  ].join(" && ") + " || exit 2";
}

/** The `hooks` block for settings.json. */
export function hookSettings() {
  const entry = (mode) => [{ hooks: [{ type: "command", command: hookCommand(mode) }] }];
  return { hooks: { SessionStart: entry("session-start"), PreToolUse: entry("pre-tool-use") } };
}
