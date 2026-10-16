---
status: accepted, amended by R29
---

# Unattended cross-repo Goal reviews, fired by the gate

A cross-repo Goal agent runs its Goal reviews itself, in its unattended cloud routine, instead of in the user's session as ADR 0001 has it for single-repo agents. The `goal-agent-review` gate workflow in each Covered repo, which already runs on every event that can make a PR gated, fires the routine's API trigger with the PR URL when a review for that agent is missing on the current head SHA, once per head SHA and agent; the routine's hourly scheduled run sweeps every Covered repo for gated PRs without a review as a backstop. In these Covered repos a closing reference is a `Closes`, `Fixes` or `Resolves` keyword in the PR body (including `owner/repo#n`; amended, see [Amendments](#amendments)), and the gate and the agent parse it by that one rule. We chose this because a review must start without being asked, for every PR however it was opened, and an unattended run cannot read GraphQL's `closingIssuesReferences`.

## Considered Options

- **A Claude Code hook in the user's session** (after `gh pr create` or a push): rejected because it fires only for PRs opened from a Claude session on the user's machine.
- **A routine GitHub trigger on each Covered repo**: rejected because its filters see only PR labels, not the closing issues' `goal-agent:<name>` labels, so every non-draft push starts a paid session, and it misses a closing reference added to the body or a label added to an issue later.
- **The hourly schedule only**: kept as the backstop, but alone it leaves the gate `pending` for up to an hour.
- **A local run on the user's PC** (Task Scheduler sweeping every few minutes): kept as the fallback if the routine's API trigger fails; it needs the PC on and gives an unattended run the user's files and keys instead of a sandbox. A self-hosted Actions runner was rejected because a `pull_request_target` job would read untrusted PR content with access to the whole PC.
- **The gate passing the GraphQL closing references in the fire payload**: rejected because the payload is untrusted text and the sweep has no payload at all.

## Consequences

- A fired run is a Goal review of that one PR only and exits; the payload is a hint, re-checked over REST (the PR is in a Covered repo and gated for this agent), otherwise the run writes nothing.
- Every new head SHA of a non-draft PR is reviewed once; the marker comment for that SHA stands for R36's "already reviewed", and no one has to ask for a re-review. Drafts are skipped.
- A run lists the PR's comments again right before posting and posts nothing if a marker for that SHA and agent already exists, so a fire and the sweep do not post twice.
- The PR comment is the review's report; no other report is written.
- Each Covered repo holds the routine's fire token as a secret per agent, alongside its trigger id; adding a Covered repo means adding the gate workflow, that secret and the Claude GitHub App.
- An issue linked only from the PR sidebar does not gate the PR.
- The API trigger is a research-preview beta (`experimental-cc-routine-2026-04-01`); if it breaks, the hourly sweep still reviews every PR, only later.

## Amendments

- **Closing-reference rule, amended by [R29][r29] (issue [#54][i54]).** A closing reference is one of GitHub's nine closing keywords (`close`, `closes`, `closed`, `fix`, `fixes`, `fixed`, `resolve`, `resolves`, `resolved`), matched case-insensitively, followed by an optional colon and then `#n` or `owner/repo#n`. This replaces the three keywords named above. It matches GitHub's own closing behaviour: anything that closes the issue on merge also gates the PR. For example, `fixed #3` and `fixes: owner/repo#3` gate.

[r29]: ../goal-agents-with-engineering-skills.md#r29
[i54]: https://github.com/hsmejky/goal-agent/issues/54
