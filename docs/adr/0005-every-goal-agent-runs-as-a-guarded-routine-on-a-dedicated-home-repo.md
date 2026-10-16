---
status: accepted
---

# Every Goal agent runs as a guarded routine on a dedicated Home repo

Every Goal agent runs in one mode, the one ADRs 0002–0004 set for cross-repo agents, even when its Goal covers a single repo. Its definition, State issue and memory live in a dedicated Home repo that is never one of its Covered repos. It runs unattended as a guarded single-repo routine on that Home repo and reaches its one or more Covered repos through `add_repo` and `gh api`. The gate fires every Goal review through the routine's API trigger, and the hourly sweep is the backstop. The single-repo mode goes away: a definition in the Covered repo's `.claude/agents/` with `memory: project`, run inside the user's session, with Goal reviews spawned by that session. The user's sessions never run a Goal agent. They consult it only through issue comments. We chose one mode because it gives one contract and one design document instead of R1–R37 plus a cross-repo delta. It also gives every agent the same issue-based way of talking to the user, and keeps every agent unattended, so no agent lags because nobody opened a session for it. This supersedes ADR 0001. Its marker comment and `goal-agent-review` commit status stay, but the user's session no longer runs the review. ADRs 0002–0004 stay as written, with the amendments each records, and now apply to every Goal agent.

## Considered Options

- **Keep both modes**: rejected because two contracts and two documents drift apart. A single-repo agent also acts only when the user opens a session for it, and its Goal reviews depend on that session spawning them.
- **Cross-repo mode with the only Covered repo as Home**: rejected because the ADR 0004 audit of commits to `main` outside `memory/` would flag every ordinary merge in that repo. Adding a second Covered repo would also mean moving the agent. ADR 0002's reasons for a dedicated repo hold for one Covered repo too.

## Consequences

- A Consultation takes from about 30 seconds to a few minutes, and up to the hourly sweep in the worst case, even for work in one repo.
- Every Goal agent needs one more repo, set up as ADR 0002 describes.
- All Goal agents draw on the user's one subscription. Routine limits are 100 scheduled runs and 100 API fires per hour per account, 30 fires per hour per routine, and a 1-hour minimum schedule interval. The number of agents is not capped up front; production use will show whether that is a problem.
- Where ADRs 0002–0004 say "cross-repo Goal agent", read "Goal agent". ADR 0002's note that a user session in the Home repo can still spawn the agent as a subagent no longer describes an intended use.
- `plugin-maintainer` in `hsmejky/ai-plugin-manager`, the only single-repo Goal agent, moves to its own Home repo after the `goal-steward` pilot, by a checklist in the design.
