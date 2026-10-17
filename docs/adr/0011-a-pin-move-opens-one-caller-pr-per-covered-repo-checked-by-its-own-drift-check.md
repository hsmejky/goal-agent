---
status: proposed
---

# A Pin move opens one caller PR per Covered repo, checked by its own drift check

The **Pin move**, the one user action that moves every Home repo and Covered repo to a new goal-agent commit, opens one PR in each Covered repo whose callers or Registry differ from the rendering at that commit. A new `pull_request` drift check in each Covered repo, holding no secrets, checks that PR before merge. Decided in [How one action opens the caller PR in every Covered repo][i138], on the [Map][i135] for opening these PRs from one user action.

Today nothing opens a Covered repo PR. Setting the `uses:` SHA in `goal-agent-review.yml` and `goal-agent-consult.yml` is a hand step listed in the sync PR's body ([R59][r59]). The renderer already holds `renderCoveredCaller` and `compareCovered`, but the only check that uses them is the gate's `callerDrift`. The gate checks out the default branch for every event, so it never sees a caller PR's own edits. Its drift result fails a job, not the required status. [ADR 0010][adr10] (proposed) has the user's local `gh` token open every PR the one action opens. [ADR 0009][adr9] (proposed) has each Covered repo's Registry rendered from the definitions that list it.

**Decision.**

1. The Pin move is one local command, run with the user's `gh` token ([ADR 0010][adr10]). It takes a full SHA on goal-agent's `main`, fetches goal-agent at that SHA, and renders with that commit's `scripts/render/render.mjs`, never with the local checkout. It reads the Roster at that SHA and each Home repo's definition at the Home repo's default branch. The Covered repos are every repo named under a definition's `## Covered repos`. Each Covered repo's Registry is the inverse: every Goal agent whose definition lists the repo, with its label and Home repo. The command opens the Home repo sync PRs and the Covered repo PRs in one run. This refines ADR 0010's "the Home repo comes from an argument": the command walks the Roster.
2. A Covered repo gets one PR holding all of its rendered files: `goal-agent-review.yml`, `goal-agent-consult.yml`, `goal-agent-drift-check.yml`, and the table under § Goal agents in this repo of `docs/agents/goal-agents.md`. The rest of that file stays hand-written. The callers' secret pairs follow from the Registry's names, so callers and Registry move in one PR. No PR is opened where all four already match.
3. Every PR the Pin move opens, in Home repos and Covered repos, uses the branch `goal-agent-sync-<sha12>` and the title `Move goal-agent pin to <sha12>`.
4. Each Covered repo gets a third caller, `goal-agent-drift-check.yml`. It is a one-step caller at the pin, runs on `pull_request` and on `push` to `main`, and holds no secrets. It fails unless:
   - the three callers carry one `uses:` SHA, and
   - each caller equals the rendering at that SHA from the Registry's names.

   It does not check the Registry against the definitions, because that needs a cross-repo read credential, which ADR 0009 rejects. The Pin move covers that case: a differing Registry becomes a PR. Its status is required next to `goal-agent-review`, a step only the user can do.
5. One repo failing does not stop the run. The command ends with a summary of each repo: its PR link, "no change", or its error. On a re-run, an open PR on the same SHA's branch counts as done for that repo rather than as a refusal.
6. A Covered repo PR's body lists, as a checklist to finish before merge, each secret name the callers reference that `gh secret list` does not show for that repo. The command never reads or sets secret values.
7. `--dry-run` prints, for each repo, what would change and which secrets are missing, and pushes nothing.
8. goal-agent, a Covered repo of its own, gets its caller PR like any other; `test/gate/own-callers.test.mjs` still holds on it.
9. A repo that no definition lists any more is outside the Pin move's reach. Removing its callers stays a hand step.
10. Unchanged:
    - [R37][r37] (the gate's trust model), including the gate's `callerDrift`.
    - [R45][r45] (the guard runs from the committed copy).
    - The Home repo drift check.
    - [ADR 0008][adr8]'s literal shared pin, which now spans three callers in each Covered repo.

## Considered Options

- **No check before merge; the gate's `callerDrift` catches drift on the next PR.** Rejected. The drift shows only after it is on `main`, and it fails a job rather than the required status.
- **The gate reads the PR head's callers.** Rejected. It changes what the gate checks out, which R37 and the Map's scope keep fixed.
- **Separate PRs for the callers and the Registry.** Rejected. Each would fail the drift check until the other merged, because the secret pairs follow from the Registry.

## Consequences

- R59 "Adding a Covered repo" step 3 renders three callers, and step 5 makes two statuses required.
- R59 "The shared pin" names the third caller.
- R59's manual "Checking a Covered repo's callers for drift" gives way to the drift check.
- The sync PR body loses its hand step for the Covered repo SHA.
- `templates/` gains `goal-agent-drift-check.yml` for Covered repos, with an action for it beside the gate and consult actions.
- `own-callers.test.mjs` covers the third caller.
- These changes land through `/to-spec`, with an Appendix D row for the R59 amendment.

[adr8]: 0008-goal-agent-workflows-run-from-goal-agent-at-the-pinned-sha.md
[adr9]: https://github.com/hsmejky/goal-agent/blob/adr/roster-and-registry/docs/adr/0009-the-roster-and-the-definitions-are-the-registry-of-record.md
[adr10]: https://github.com/hsmejky/goal-agent/blob/adr/local-token-path/docs/adr/0010-goal-agent-prs-across-repos-are-opened-locally-with-the-users-token.md
[r37]: ../goal-agents-with-engineering-skills.md#r37
[r45]: ../goal-agents-with-engineering-skills.md#r45
[r59]: ../goal-agents-with-engineering-skills.md#r59
[i135]: https://github.com/hsmejky/goal-agent/issues/135
[i138]: https://github.com/hsmejky/goal-agent/issues/138
