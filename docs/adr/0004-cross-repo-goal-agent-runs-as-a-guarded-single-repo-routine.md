---
status: accepted
---

# A cross-repo Goal agent runs as a guarded single-repo routine

A cross-repo Goal agent runs in a single-repo cloud routine on its Home repo. It reaches each Covered repo through the built-in `add_repo` tool and then `gh api`, never through a clone. The Home repo's project hooks guard the agent, so R26 and the memory-only push are enforced rather than requested. We chose this because a multi-repo routine loads no repo hooks and installs no repo-enabled plugins, which would leave every boundary in prose. The agent works only from issues, PRs, diffs and files fetched by path, so it never needs a local tree. Work that needs a whole tree is engineering work, and that belongs to the user's sessions. This amends ADR 0002: the routine prompt no longer only points at the Home repo. It names the owner, the Covered repos and the writes it asks for, because the auto-mode classifier passes a Covered repo write only when the user's own messages ask for it. A gate fire's payload carries only the target URL.

## Considered Options

- **A multi-repo routine with the Covered repos as sources**: rejected because no hooks load, so R26, the memory-only push and Halted would rest on prose, with the auto-mode classifier as an incidental second guard.
- **Plugin hooks enabled from the Home repo**: rejected because a cloud session never installs repo-enabled plugins.
- **The guard reading `guard.sh` from disk**: rejected because a shell redirect could rewrite it mid-session.

## Consequences

- The guard (`SessionStart` and `PreToolUse` hooks in the Home repo) denies:
  - the Skill tool;
  - a `git push` that is not its own command or that touches anything outside `memory/`;
  - `git clone` and `gh repo clone`;
  - every non-GET `gh api` call and every GraphQL mutation, except under `repos/<owner>/<repo>/issues…` for the Home repo and the Covered repos;
  - Edit, Write and NotebookEdit inside the Home repo outside `memory/`;
  - every `mcp__` tool except `add_repo`;
  - every tool while the agent is Halted, which the guard reads from the State issue once at `SessionStart`.
- The hook command runs the copy of the guard committed on `origin/main`, not the file on disk.
- The guard reads the Covered repo list from the definition. The routine prompt names the same list, so the two must be changed together.
- In cross-repo mode, R26 becomes "enforced by the Home repo guard".
- The guard matches shell text, so a `curl` with a token, a script or a rewritten local ref can still get past it. The auto-mode classifier and the Home repo audit are the backstops.
- The Home repo audit sets Halted and opens one issue for any commit to `main` that touches anything outside `memory/` and did not arrive through a merged PR. The user changes the definition, workflows and hooks only through PRs. Covered repos have no audit, because their Goal-review gate still stands between a stray push and `main`.
- The classifier is nondeterministic, so a denied write can occur. Idempotent writes and the hourly sweep retry it.
