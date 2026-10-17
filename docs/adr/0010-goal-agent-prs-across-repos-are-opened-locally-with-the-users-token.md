---
status: proposed
---

# Goal agent PRs across repos are opened locally with the user's token

Every PR that moves Home repos and Covered repos to a new goal-agent commit is opened with the user's local `gh` token, from a command the user runs. The dispatch sync retires. Decided on the [Map][i135] for opening these PRs from one user action, after the dispatch sync was found unable to open its own PR ([#133][i133]).

The Home repo sync (`templates/goal-agent-sync.yml`, then `.github/actions/home-sync`, then `scripts/home/sync.mjs`) pushes with the calling job's `GITHUB_TOKEN`. GitHub refuses a push that creates or changes `.github/workflows/` files from that token, and the token cannot be given the Workflows permission. Every sync changes at least the `uses:` SHA, so the dispatch can never open its PR. This was seen in [goal-steward-home run 39021696063][run]. The Map's Destination is that one user action opens all the PRs, and that action may be a local command.

The credentials research ([#136][i136], [note][note]) and the trial run ([#139][i139]) found:

- All four candidates can push workflow changes and open a PR whose workflows start at once.
- A repo secret is readable by every same-repo `pull_request` job.
- An environment that admits only `main` refuses `pull_request` jobs but admits `pull_request_target` jobs.
- A personal account has no shared Actions secrets, so each repo would hold its own copy.

Running `sync.mjs` locally with the user's `gh` token opened [goal-steward-home PR 14][pr14]. Its drift check started at once and passed, with no close and reopen.

**Decision.**

1. Every PR that moves Home repos and Covered repos to a new goal-agent commit is opened with the user's local `gh` token, from a command the user runs, or from the user's session on request (as [R59][r59] already allows). This covers the Home repo sync PRs now and the Covered repo caller PRs ([#138][i138]).
2. The dispatch sync retires.
   - `templates/goal-agent-sync.yml`, the `home-sync` composite action, and R59's step "Allow GitHub Actions to create pull requests" all go.
   - `scripts/home/sync.mjs` becomes a local command only. The Home repo comes from an argument, and the token from `gh auth token`.
   - The renderer lists `.github/workflows/goal-agent-sync.yml` as retired, so the next sync deletes it from each Home repo, as it did for `scripts/gate/` and `scripts/home/`.
3. [R38][r38] ("The Home repo holds no secrets") stays as written. Its bound for this path is:
   - No workflow can read the token, because no Actions secret exists for this path.
   - No `pull_request` or `pull_request_target` job and no routine session can read it. It lives only in the user's local `gh` credential store, which a cloud routine session never reaches.
   - It can write whatever the user's account can, and only the user's command uses it.
4. A PR opened this way starts its workflows, so R59 sync step 3 (close and reopen to start the drift check) goes away.
5. Unchanged: [R37][r37] (the gate's trust model), [R45][r45] (the guard runs from the committed copy), [ADR 0008][adr8]'s literal shared pin, and the drift check.

This amends the "Sync action renders from the target commit" amendment of ADR 0008, which has the sync action push with `GITHUB_TOKEN`. [ADR 0009][adr9] (proposed, on its branch) is not affected.

## Considered Options

- **A GitHub App or fine-grained PAT held as an environment secret that admits only `main`, in each Home repo.** Rejected. It reopens R38 in every Home repo, because a personal account can't share a secret. It needs a standing rule that no `pull_request_target` job names the environment, and that rule holds only while changes to `main` are reviewed. It needs key or PAT rotation.
- **One central secret in goal-agent with an App installed on every repo.** Rejected. Home repos stay without secrets, but one credential writes workflows everywhere, which is the widest blast radius. It still needs the `pull_request_target` rule.
- **The sync leaves workflow files out and lists their changes for the user to push.** Rejected. It is a hand step on every bump.

## Consequences

- The one action is a local command, not a button on GitHub. The user needs `gh` authenticated with the `workflow` scope.
- No credential is added to guard or rotate.
- PRs are authored by the user's account.
- What changes: R59's sync steps, the Section 3 table line that says the sync opens its PR with `GITHUB_TOKEN`, the sync template comment, and the tests asserting the dispatch (`test/home/workflow.test.mjs`). These changes land through `/to-spec`, with an Appendix D row for the R59 amendment.

[adr8]: 0008-goal-agent-workflows-run-from-goal-agent-at-the-pinned-sha.md
[adr9]: https://github.com/hsmejky/goal-agent/blob/adr/roster-and-registry/docs/adr/0009-the-roster-and-the-definitions-are-the-registry-of-record.md
[r37]: ../goal-agents-with-engineering-skills.md#r37
[r38]: ../goal-agents-with-engineering-skills.md#r38
[r45]: ../goal-agents-with-engineering-skills.md#r45
[r59]: ../goal-agents-with-engineering-skills.md#r59
[run]: https://github.com/hsmejky/goal-steward-home/actions/runs/39021696063
[pr14]: https://github.com/hsmejky/goal-steward-home/pull/14
[note]: https://github.com/hsmejky/goal-agent/blob/research/workflow-credentials/docs/research/workflow-credentials.md
[i133]: https://github.com/hsmejky/goal-agent/issues/133
[i135]: https://github.com/hsmejky/goal-agent/issues/135
[i136]: https://github.com/hsmejky/goal-agent/issues/136
[i138]: https://github.com/hsmejky/goal-agent/issues/138
[i139]: https://github.com/hsmejky/goal-agent/issues/139
