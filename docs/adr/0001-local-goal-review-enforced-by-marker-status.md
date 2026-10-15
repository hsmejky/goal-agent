---
status: superseded by ADR-0005
---

# Local Goal review, enforced by a marker-checking commit status

A PR that closes an issue labelled `goal-agent:<name>` needs a Goal review by that Goal agent before merge. We run the review locally: the user's session spawns the Goal agent with the brief `Goal review of PR #<n>`, on the user's subscription. The agent posts one PR comment whose first line is a marker (`<!-- goal-agent-review:<name> sha=<head SHA> verdict=pass|blocked -->`). A cheap GitHub workflow only checks for that marker on the current head SHA and sets the commit status `goal-agent-review`; branch protection on `main` requires it, with enforcement for admins and the GitHub Actions app as the expected source. We did not run the Goal agent itself in GitHub Actions, because an unattended agent run is out of scope for Goal agents and would bill outside the user's subscription, and because nothing but a status check stops the review from being forgotten, as it was in `ai-plugin-manager`, where the user had to ask whether it had happened.

## Considered Options

- **Goal agent run in CI on every PR event**: rejected for the reasons above; it would also need an API key as a repository secret.
- **No enforcement, review on request only**: the status quo in `ai-plugin-manager`; rejected because the step was forgotten.
- **Check run instead of commit status**: a workflow triggered by `issue_comment` cannot attach a check run to the PR head, so the marker check reports a commit status.

## Consequences

- The status proves a review was posted for this exact commit by an account with write access, not that the review was sound.
- `issue_comment` workflows run from the default branch, so the gate works only after the workflow is merged to `main`.
- Only closing references (`Closes`, `Fixes`, `Resolves`) gate a PR; `Part of #N` and `Refs #N` do not.
- Without enforcement for admins, `gh pr merge --admin` bypasses the gate.
- Without the GitHub Actions app as the expected source, anyone with write access can post the status by hand.
- The workflow uses `pull_request_target` and runs nothing from the PR, so a PR cannot edit it to pass itself.
- PRs already open at installation get a status only on their next event.
- Details: `docs/goal-agents-with-engineering-skills.md`, R29–R37.
