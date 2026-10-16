---
status: accepted
---

# The guard restricts cloud sessions only

The guard's `SessionStart` and `PreToolUse` hooks (R45) are project hooks in the Home repo's `.claude/settings.json`, so they run in every Claude Code session opened in a clone of the Home repo, including the user's own. Applied there, the R45 denies would block the user from the Skill tool, from edits outside `memory/` and from `mcp__` tools, which are exactly what the user needs to prepare the PRs that change the definition, the contract, the docs and the pinned scripts. The guard therefore enforces its denies only when `CLAUDE_CODE_REMOTE` is exactly `"true"`, which Claude Code sets in cloud sessions and leaves unset in the local CLI. With any other value, or none, `SessionStart` does nothing (no GitHub call, no session record) and `PreToolUse` allows every tool without reading a record. In a cloud session nothing changes: every deny applies, and a missing or unreadable session record still denies every tool. The guard reads the variable at its entry point, and the hook command checks it first and exits 0 before it extracts the guard from `origin/main`, so a local clone whose `origin/main` has no `scripts/` yet (or without bash tooling) is never blocked. Hook processes inherit the Claude Code process environment, and `CLAUDE_ENV_FILE` affects only Bash and PowerShell commands, so the agent cannot change the variable for a hook from inside its session.

## Considered Options

- **Guard every session in the Home repo**: rejected because it locks the user out of preparing the PRs through which the Home repo changes.
- **A custom marker variable that only the routine carries**: not chosen because it is out of scope for now. It would tell routine sessions from interactive cloud sessions, but it needs a signal the routine agent cannot unset and no documented one exists.

## Consequences

- If Claude Code renames or drops `CLAUDE_CODE_REMOTE`, the routine runs unguarded. The Home repo audit (R50) and the auto-mode classifier remain the backstops.
- The user's interactive web sessions on a Home repo are guarded the same way as the routine, because no documented signal tells a routine session from an interactive cloud session.
- The fix reaches a Home repo only when the user recopies `scripts/guard` and bumps `goal-agent-pin` in one PR (ADR 0006).
- ADR 0004 stays as written; this ADR narrows where its guard applies.
