---
status: proposed
---

# A Pin move opens one caller PR per Covered repo, checked by its own drift check

The **Pin move**, the one user action that moves every Home repo and Covered repo to a new goal-agent commit, opens one PR in each Covered repo whose callers or Registry differ from the rendering at that commit. A new `pull_request` drift check in each Covered repo, holding no secrets, checks that PR before merge. Decided in [How one action opens the caller PR in every Covered repo][i138], on the [Map][i135] for opening these PRs from one user action.

Today nothing opens a Covered repo PR. Setting the `uses:` SHA in `goal-agent-review.yml` and `goal-agent-consult.yml` is a hand step listed in the sync PR's body ([R59][r59]). The renderer already holds `renderCoveredCaller` and `compareCovered`, but the only check that uses them is the gate's `callerDrift`. The gate checks out the default branch for every event, so it never sees a caller PR's own edits. Its drift result fails a job, not the required status. [ADR 0010][adr10] (proposed) has the user's local `gh` token open every PR the one action opens. [ADR 0009][adr9] (proposed) has each Covered repo's Registry rendered from the definitions that list it.

**Decision.**

1. The Pin move is one local command, run with the user's `gh` token ([ADR 0010][adr10]). It takes a full SHA on goal-agent's `main`, fetches goal-agent at that SHA, and renders with that commit's `scripts/render/render.mjs`, never with the local checkout. It reads the Roster at goal-agent's `main`, not at the target SHA, so a Roster row added after the shared pin takes effect without moving the pin (point 15). It reads each Home repo's definition at the Home repo's default branch. The Covered repos are every repo named under a definition's `## Covered repos`. Each Covered repo's Registry is the inverse: every Goal agent whose definition lists the repo, with its label and Home repo. The command opens the Home repo sync PRs and the Covered repo PRs in one run. This refines ADR 0010's "the Home repo comes from an argument": the command walks the Roster.
2. A Covered repo gets one PR holding all of its rendered files: `goal-agent-review.yml`, `goal-agent-consult.yml`, `goal-agent-drift-check.yml`, the table under § Goal agents in this repo of `docs/agents/goal-agents.md`, and the agent lines of the `### Goal agents` block in `CLAUDE.md`, rendered from the Registry (the block is created when missing). The rest of those files stays hand-written. The callers' secret pairs follow from the Registry's names, so callers and Registry move in one PR. No PR is opened where all of them already match.
3. Every PR the Pin move opens, in Home repos and Covered repos, uses the branch `goal-agent-sync-<sha12>` and the title `Move goal-agent pin to <sha12>`.
4. Each Covered repo gets a third caller, `goal-agent-drift-check.yml`. It is a one-step caller at the pin, runs on `pull_request` and on `push` to `main`, and holds no secrets. It fails unless:
   - the three callers carry one `uses:` SHA, and
   - each caller equals the rendering at that SHA from the Registry's names.

   It does not check the Registry against the definitions, because that needs a cross-repo read credential, which ADR 0009 rejects. The Pin move covers that case: a differing Registry becomes a PR. Its status is required next to `goal-agent-review`, a step only the user can do.
5. One repo failing does not stop the run. The command ends with a summary of each repo: its PR link, "no change", or its error. On a re-run, an open PR on the same SHA's branch counts as done for that repo rather than as a refusal.
6. A PR's body and the run's report list, as a checklist, the user-only steps the command can see are missing. For a Covered repo: each secret name the callers reference that `gh secret list` does not show, each Registry agent's `goal-agent:<name>` label, and the event policy for `goal-agent-review.yml`. For a Home repo: its `goal-agent:state` and triage labels. The PR is opened anyway. Merging it first is safe: an agent without credentials is never fired, so PRs that need its review stay pending (the gate fails closed), and the repo's other agents are unaffected. The command never reads or sets secret values, and never creates labels or policies.
7. `--dry-run` prints, for each repo, what would change and which secrets are missing, and pushes nothing.
8. goal-agent, a Covered repo of its own, gets its caller PR like any other; `test/gate/own-callers.test.mjs` still holds on it.
9. A repo that no definition lists any more is outside the Pin move's reach. Removing its callers stays a hand step.
10. A Pin move imposes no merge order. No check compares pins across repos: the Home repo drift check compares a Home repo only with its own definition's `goal-agent-pin`, the Covered repo drift check compares the three callers with each other and with the rendering at their own SHA, and the gate's `callerDrift` stays within the Covered repo. The fire sends only the PR URL, and the Consultation fire only the comment URL. So any merge order passes every check, and repos at different pins between merges is a passing state. Between merges a gate at one pin can fire a routine at another, each running its own pinned code. [R59][r59]'s "merge in one sitting" stays as advice, reworded: until every PR of a Pin move is merged, the shared pin is broken.
11. A goal-agent commit that changes the interface between gate and routine (the marker or status format, the fire payload, the consult comment's shape) must work against the previous pin in both directions: gate at the new pin with routine at the old, and the reverse. goal-agent's own review checks this, not a check across repos.
12. The report is the detector. Every Pin move run, `--dry-run` included, ends with a per-repo table: the pin on `main`, the open Pin move PR if any, and whether the repo is at the target. A re-run with the same SHA is how the user checks and finishes a partly merged Pin move.
13. A newer Pin move supersedes an older one. A run to SHA B closes every open `goal-agent-sync-<sha12>` PR for another SHA in each repo it touches, with a comment linking the new PR, so at most two pins are in use: the one on `main` and the target. A repo that already merged A is simply moved on to B.
14. Adding a Goal agent starts with three authoring acts, which are the user's decisions and not hand steps: create the Home repo, commit the definition (with its `## Covered repos`) to the Home repo's `main`, and merge the agent's Roster row. Adding a Covered repo to an existing agent starts with the definition's `## Covered repos` line. Decided in [How a Pin move adds a Goal agent][i142].
15. Adding is an ordinary Pin move, with no subcommand: the user runs it at the current shared pin, and only the repos that differ get a PR, normally the new Home repo and its Covered repos. A Home repo's first adoption is the same render: where the renderer refuses a Home repo that was never synced today, it creates the missing files instead. Its only prerequisite is `.claude/agents/<name>.md` on the Home repo's `main`; the Pin move writes its `goal-agent-pin` line.
16. A first adoption also creates the Home repo's generic files from templates in goal-agent: `CLAUDE.md`, `README.md`, `memory/README.md`, and the Engineering skills docs `docs/agents/issue-tracker.md`, `triage-labels.md` and `domain.md`, with the agent and repo names substituted. Each is created only when missing and never rewritten; the Home repo owns it from then on, and the Home repo drift check ignores it. Sections the drift check owns, such as `## Goal agent operations` in `issue-tracker.md`, stay rendered on every Pin move.
17. The Pin move checks the name rules ([R57][r57]) while reading the Roster and the definitions: a name that does not match `[a-z0-9-]+`, or that another Goal agent covering the same repo already uses, is skipped and reported like any repo failure (point 5). So is a Roster row whose Home repo or definition is missing.
18. Adding a Goal agent adds no new kind of user-only step. The Home repo labels count under "label", and the routine prompt naming the Covered repos ([R42][r42]) counts under "routine". [R59][r59] gets an "Adding a Goal agent" checklist, and "Adding a Covered repo" shrinks to the same shape: what you decide (point 14), then the Pin move, then the user-only steps in dependency order:
    1. Merge the Home repo PR.
    2. Create the routine (for a Covered repo: change its prompt), and set the secrets from it in each Covered repo.
    3. Create the labels, install the Claude GitHub App, and set the event policy.
    4. Merge the Covered repo PRs.
    5. Make both statuses required after the first real run.
19. Unchanged:
    - [R37][r37] (the gate's trust model), including the gate's `callerDrift`.
    - [R45][r45] (the guard runs from the committed copy).
    - The Home repo drift check.
    - [ADR 0008][adr8]'s literal shared pin, which now spans three callers in each Covered repo.

## Considered Options

- **No check before merge; the gate's `callerDrift` catches drift on the next PR.** Rejected. The drift shows only after it is on `main`, and it fails a job rather than the required status.
- **The gate reads the PR head's callers.** Rejected. It changes what the gate checks out, which R37 and the Map's scope keep fixed.
- **Separate PRs for the callers and the Registry.** Rejected. Each would fail the drift check until the other merged, because the secret pairs follow from the Registry.
- **Merge Home repos first.** Rejected. No check depends on order, so it protects nothing.
- **Merge Covered repos first.** Rejected, for the same reason.
- **An order the tool enforces**, for example Covered PRs held as drafts until the Home PRs merge. Rejected. No check depends on order, and the hold adds a step for nothing.
- **A breaking Pin move names a required merge order in its PR bodies.** Rejected. Adjacent-pin compatibility (point 11) removes the need.
- **The fire carries the pin and the routine refuses a mismatch.** Rejected. It changes the fire path ([R37][r37], [ADR 0003][adr3]), which is outside the Map's scope.
- **A CI check across repos for mixed pins.** Rejected. It needs the read credential ADR 0009 rejects; the report (point 12) detects it instead.
- **Read the Roster at the target SHA.** Rejected. A new Roster row is a new goal-agent commit, so adding one agent would move the whole fleet and open a PR in every Home repo and Covered repo. Reading `main` lets an old SHA's code parse a newer Roster; the table is two plain columns, and a row it cannot parse is skipped and reported (point 17).
- **The Pin move creates the Home repo from the Roster row.** Rejected. A typo in the Roster would create a repo, and the definition would need a place to live before its Home repo exists, against [ADR 0009][adr9].
- **Creating the Home repo as a new user-only step.** Rejected. It is the place the definition is written, so it belongs with authoring (point 14), and it would add a kind to R59's user-only list.
- **The user runs the Engineering skills setup in a new Home repo.** Rejected. The files are generic across Home repos, and the setup is a hand step outside R59's user-only list.
- **A static `### Goal agents` block in a Covered repo's `CLAUDE.md`, pointing to the Registry.** Rejected. Writing the block the first time would stay a hand step, and the agents that read `CLAUDE.md` on load would lose the list.
- **Refuse a Covered repo PR until its user-only steps are done.** Rejected. Merging early is safe (point 6), and the refusal forces a second run.

## Consequences

- R59 "Adding a Covered repo" step 3 renders three callers, and step 5 makes two statuses required.
- R59 gains "Adding a Goal agent", and "Adding a Covered repo" is rewritten in its shape (point 18). The name check, the Covered repo PR, the `CLAUDE.md` block and the Registry row leave the hand steps.
- `adoptFiles` creates a never-synced Home repo's files instead of refusing it, and the "do the first adoption by hand" message goes. `templates/` gains the Home repo's generic files (point 16).
- ADR 0009's Roster is read at goal-agent's `main` (point 1).
- R59 "The shared pin" names the third caller.
- R59's manual "Checking a Covered repo's callers for drift" gives way to the drift check.
- The sync PR body loses its hand step for the Covered repo SHA.
- `templates/` gains `goal-agent-drift-check.yml` for Covered repos, with an action for it beside the gate and consult actions.
- `own-callers.test.mjs` covers the third caller.
- R59 "Re-adoption" step 4 and the message at `scripts/home/sync.mjs:110` change accordingly: the shared pin is broken until every PR of a Pin move is merged. `/to-spec` does this.
- These changes land through `/to-spec`, with an Appendix D row for the R59 amendment.

[adr3]: 0003-unattended-cross-repo-goal-reviews-fired-by-the-gate.md
[adr8]: 0008-goal-agent-workflows-run-from-goal-agent-at-the-pinned-sha.md
[adr9]: https://github.com/hsmejky/goal-agent/blob/adr/roster-and-registry/docs/adr/0009-the-roster-and-the-definitions-are-the-registry-of-record.md
[adr10]: https://github.com/hsmejky/goal-agent/blob/adr/local-token-path/docs/adr/0010-goal-agent-prs-across-repos-are-opened-locally-with-the-users-token.md
[r37]: ../goal-agents-with-engineering-skills.md#r37
[r42]: ../goal-agents-with-engineering-skills.md#r42
[r45]: ../goal-agents-with-engineering-skills.md#r45
[r57]: ../goal-agents-with-engineering-skills.md#r57
[r59]: ../goal-agents-with-engineering-skills.md#r59
[i135]: https://github.com/hsmejky/goal-agent/issues/135
[i138]: https://github.com/hsmejky/goal-agent/issues/138
[i142]: https://github.com/hsmejky/goal-agent/issues/142
