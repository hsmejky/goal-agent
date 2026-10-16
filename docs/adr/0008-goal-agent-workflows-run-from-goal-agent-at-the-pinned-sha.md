---
status: accepted
---

# Goal agent workflows run from goal-agent at the pinned SHA

The gate, the Consultation, the audit and the staleness check run from goal-agent as composite actions (`hsmejky/goal-agent/.github/actions/<unit>@<sha>`), at the full 40-hex SHA written in the caller's `uses:` line. No gate or Home workflow script is copied into a Covered repo or a Home repo any more.

GitHub downloads the action's repository at that SHA, and each action runs goal-agent's scripts from `github.action_path` ("The path where an action is located. This property is only supported in composite actions.", [Contexts reference][ctx]). The scripts that run therefore come from the `uses:` commit, with no second SHA to keep in step and no checkout of goal-agent.

The SHA is the shared `goal-agent-pin`: a full commit SHA on goal-agent's `main` (a tag may follow only as a comment). It is the same in every `uses:` line of a Home repo's callers and of each Covered repo's callers, and the same across all Home repos covering one Covered repo (literal equality, per [#94][i94]).

A Covered repo keeps two thin callers (gate and Consultation). A Home repo keeps thin callers for the audit, the staleness check, the drift check and the sync. Each caller holds its trigger, `permissions`, `if`, `concurrency` and `runs-on`, and its job has exactly one step: the `uses:` of the action.

Values handed to an action, as `with:` inputs or as the calling step's `env`, are visible to every step inside the action, and any other step in the caller job would run alongside them. The action therefore does its own checkout of the caller repo (default branch, `persist-credentials: false`, nothing from the PR) and its own Node setup. Its internal steps are goal-agent code plus third-party actions pinned by full SHA and reviewed in goal-agent.

Secrets go by explicit name: the calling step's `env` names each agent's `GOAL_AGENT_<NAME>_FIRE_TOKEN` and `GOAL_AGENT_<NAME>_TRIGGER_ID`, one pair per installed agent. GitHub does not document that a calling step's `env` reaches the steps inside a composite action, so [#112][i112] tests it on a live run. If it does not, the pairs go as declared `with:` inputs that the action maps to `env` on its script step only. Never `secrets: inherit` or `toJSON(secrets)`.

Trust ([R37][r37]) is unchanged: `pull_request_target` runs the caller from the default branch, and the action is fetched at the immutable SHA in that caller and runs nothing from the PR. The audit and staleness actions take no secrets; they use the job's `GITHUB_TOKEN` (`github.token`), with the permissions the caller job grants.

This answers [ADR 0006][adr6]'s rejection of "Home repos fetch a pinned version when they run" for these workflows. A full SHA in the `uses:` line is immutable and is reviewed in the caller's PR like any other change, and in a Home repo the audit of `main` ([R50][r50]) sees it too. GitHub fetches the action for an Actions job, not the agent's session, so no code reaches the session by a network fetch.

The guard is the one thing that runs inside the session, so it stays a committed copy on the Home repo's `origin/main` ([R45][r45]): `scripts/guard/` and the shared modules it imports (moved to `scripts/lib/`), byte-identical to goal-agent at the pin, with `.claude/settings.json` from `templates/home-settings.json` at the pin.

The caller files are rendered, not hand-copied. `templates/` at the pin holds the canonical caller files, and Appendix E of the [design][design] names them as each Covered repo's and Home repo's workflow text. Their only parameters are the `uses:` SHA and, in the gate and Consultation callers, one secret-pair block per agent in the Covered repo's registry. A Home repo's drift check and a Covered repo's gate action compare the callers with their rendered templates, and the contract text is rendered from the design at the pin with R59's substitutions ([#107][i107]) and checked the same way. Tickets [#114][i114]-[#117][i117] settle how.

**Decision.** This ADR supersedes [ADR 0006][adr6] for the gate, Consultation, audit and staleness workflows: they are no longer copied and pinned, but called at the pin. It amends ADR 0006 for the contract text: the text is still a committed file in the Home repo pinned by `goal-agent-pin`, but rendered from the design at the pin and checked, not hand-adopted. It keeps ADR 0006 for the guard: tested here, copied into each Home repo, pinned, and run from the copy on `origin/main`, never fetched at run time.

## Considered Options

- **Copied scripts, the status quo ([ADR 0006][adr6])**: rejected because every design change is hand-copied into each Home repo and Covered repo, which produced re-adoption issues ([#84][i84], [#85][i85], [#103][i103]), and nothing checks that a copy matches its source word for word. A second Home repo doubles the copies.
- **Reusable workflows** (`uses: hsmejky/goal-agent/.github/workflows/<unit>.yml@<sha>`): not chosen. A called workflow keeps the caller job to one `uses:` line, which is its real advantage. But the `github` context in a called workflow "is always associated with the caller workflow" ([Reusing workflow configurations][reuse]), so `github.workflow_sha` names the caller's commit. GitHub's [Contexts reference][ctx] documents `job.workflow_sha` ("The commit SHA of the workflow file that defines the current job.") and `job.workflow_repository` for checking out the workflow's own source, so the option is viable. It loses on these costs:
  - The self-commit is a second checkout that needs a guard step comparing `git rev-parse HEAD` with `job.workflow_sha`; a composite action needs no guard, because nothing is checked out.
  - `job.workflow_sha` is not yet verified on a live `pull_request_target` or `issue_comment` run.
  - A called workflow reads only the secrets declared under `on.workflow_call.secrets`, so a Covered repo's agents would need numbered optional slots and an `agents` input; a fifth agent would be a goal-agent change. The composite action takes each pair by name.
  - The caller still holds the triggers and the `GITHUB_TOKEN` permissions, which the called workflow can only downgrade ([Reusing workflow configurations][reuse]), so it is still a rendered, checked copy.

  The OIDC `job_workflow_sha` claim (`id-token: write`) would be only a fallback if `job.workflow_sha` proved unusable, never the default, because it adds a permission to every gate job on `pull_request_target`.
- **Fixed minimal caller templates, stated but not compared**: rejected because the job wrapper would become a new unchecked hand copy, which is the problem this ADR removes. A dropped permission or a changed trigger would silently weaken the gate.
- **Branch or tag refs in `uses:`**: rejected because both are mutable, so a `pull_request_target` job with a write token would run whatever the ref points to at run time, unreviewed in the caller's repo.
- **`secrets: inherit`, or `toJSON(secrets)` passed to an input**: rejected because code from goal-agent would receive every secret in the Covered repo instead of the pairs it needs.
- **Dependabot or Renovate bumps of goal-agent refs**: rejected because a bot bump in one repo breaks the shared pin across the Home repos and Covered repos that must name the same SHA.
- **Git submodule of goal-agent in each Home repo or Covered repo**: rejected because cloud routines clone fresh and may not initialise submodules, and a missing submodule would fail silently: the session would run with no contract or no guard code rather than stop.
- **Plugin route**: deferred to [#101][i101]. If it comes back "yes", its own ADR may replace the guard copy and the rendered contract; nothing here blocks that.

## Consequences

- A gate or Home workflow fix reaches a repo by changing one SHA in its callers, not by recopying scripts. `.github/scripts/goal-agent-review/` goes away from Covered repos, and `scripts/gate/` and `scripts/home/` from Home repos.
- Every pin bump, text-only included, needs the two-line `uses:` SHA PR in each shared Covered repo. [#94][i94]'s "only if `scripts/gate/` changed" economy is dropped so that the shared-pin check stays literal equality.
- The same-commit property is tested in goal-agent: a static test asserts that each action runs its scripts only from `github.action_path` and that no step checks out goal-agent.
- A Covered repo's drift is a `uses:` SHA that differs from the shared pin, or a caller that differs from its rendered template. How each is detected, and how a pin bump is synced, is settled in [#114][i114]-[#117][i117].
- If GitHub cannot fetch the action at the pinned SHA, the job fails and the gate stays red: a loud failure, not a silent fallback.
- The caller templates, [R59][r59]'s checklists, [R25][r25], [R38][r38], [Appendix D][appd] and [Appendix E][design] change to describe this setup in the tickets that build it. ADRs 0001-0005 and 0007 stay as written; ADR 0007's guard fix still reaches a Home repo by recopying the guard at a new pin.

[ctx]: https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#job-context
[reuse]: https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations
[adr6]: 0006-goal-agent-scripts-are-tested-here-and-copied-pinned-into-each-home-repo.md
[design]: ../goal-agents-with-engineering-skills.md#appendix-e-covered-repo-files
[appd]: ../goal-agents-with-engineering-skills.md#appendix-d-decisions-amended-since-filing
[r25]: ../goal-agents-with-engineering-skills.md#r25
[r37]: ../goal-agents-with-engineering-skills.md#r37
[r38]: ../goal-agents-with-engineering-skills.md#r38
[r45]: ../goal-agents-with-engineering-skills.md#r45
[r50]: ../goal-agents-with-engineering-skills.md#r50
[r59]: ../goal-agents-with-engineering-skills.md#r59
[i84]: https://github.com/hsmejky/goal-agent/issues/84
[i85]: https://github.com/hsmejky/goal-agent/issues/85
[i94]: https://github.com/hsmejky/goal-agent/issues/94
[i101]: https://github.com/hsmejky/goal-agent/issues/101
[i103]: https://github.com/hsmejky/goal-agent/issues/103
[i107]: https://github.com/hsmejky/goal-agent/issues/107
[i112]: https://github.com/hsmejky/goal-agent/issues/112
[i114]: https://github.com/hsmejky/goal-agent/issues/114
[i117]: https://github.com/hsmejky/goal-agent/issues/117
