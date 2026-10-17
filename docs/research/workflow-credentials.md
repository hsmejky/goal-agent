# Credentials that can open PRs changing `.github/workflows/` across the user's repos

Research for hsmejky/goal-agent#136 (child of Map #135). Sources are GitHub's own documentation, fetched 2026-10-17. "Silent" means the cited pages do not say; anything marked "inference" is not a documented fact.

## Facts that hold for every candidate

- `GITHUB_TOKEN` is an installation access token scoped to the workflow's own repository, and it expires when the job finishes (at most 6 hours). [GITHUB_TOKEN concept](https://docs.github.com/en/actions/concepts/security/github_token)
- "Events triggered by the `GITHUB_TOKEN` will not create a new workflow run", except `workflow_dispatch` and `repository_dispatch`. A `pull_request` event it opens, reopens or synchronizes creates runs only in an approval-required state. [GITHUB_TOKEN concept](https://docs.github.com/en/actions/concepts/security/github_token), [Triggering a workflow](https://docs.github.com/en/actions/using-workflows/triggering-a-workflow). The docs recommend "a GitHub App installation access token or a personal access token instead of `GITHUB_TOKEN`" when events must trigger runs.
- Writing workflow files needs the separate **Workflows** repository permission (write). In the REST permission tables it is the extra mark on `PUT/DELETE /contents/{path}`, `POST/PATCH /git/refs` and releases; `POST /pulls` needs only Pull requests: write and has no such mark. [Permissions for fine-grained PATs](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens), [Permissions for GitHub Apps](https://docs.github.com/en/rest/overview/permissions-required-for-github-apps)
- The refusal text seen in run 39021696063 ("refusing to allow a GitHub App to create or update workflow ... without `workflows` permission") is not in the official docs pages I fetched; it appears only in community threads. The docs are silent on whether `GITHUB_TOKEN` can ever modify workflow files; the permission tables imply it cannot. Treat it as established by the observed failure, not by docs.
- Event semantics: `pull_request` runs on the PR merge commit (`GITHUB_SHA` is the merge commit); `pull_request_target` "runs in the context of the default branch of the base repository", not the merge commit; `workflow_dispatch` and `repository_dispatch` run only if the workflow file exists on the default branch. [Events that trigger workflows](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows)
- Secrets: "With the exception of `GITHUB_TOKEN`, secrets are not passed to the runner when a workflow is triggered from a forked repository"; not available to Dependabot-triggered events; "any user with write access to your repository has read access to all secrets configured in your repository"; `pull_request_target` and `workflow_run` "are privileged" and "may have repository write access and access to referenced secrets"; environment secrets can be gated by required reviewers; rotate periodically. [Using secrets](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions), [Security hardening](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions), [About secrets](https://docs.github.com/en/actions/concepts/security/secrets)
- Approval of runs is documented only for fork PRs ("may require manual approval"); the page says nothing about PRs opened by a PAT or an App. [Approve runs from forks](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/approve-runs-from-forks)
- The docs list three secret levels: organization, repository, environment. They are silent on whether a personal account can hold account-level shared secrets. Inference: all repos sit under the personal account `hsmejky`, so a secret is per repository. Verify in the Settings UI.

## Candidate 1: GitHub App installation token with `workflows`

- **Push and open PR:** Yes, with Contents: write, Pull requests: write and Workflows: write on the installation.
- **Starts workflows:** Yes. It is an installation token, not `GITHUB_TOKEN`, so the "no new workflow run" rule does not apply, and the docs name an App token as the fix. Docs do not discuss approval-required state for non-`GITHUB_TOKEN` same-repo PRs (only forks), so both `pull_request` and `pull_request_target` should fire (inference; confirm once by trial).
- **Where the secret lives:** App client ID (not secret) plus a long-lived **private key**. A job mints a token with `actions/create-github-app-token` (`client-id`, `private-key`, `owner`, `repositories`, `permission-*`); the token lasts 1 hour and is revoked in the action's post step. [create-github-app-token](https://github.com/actions/create-github-app-token), [Installation access token](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app). The key must be a secret readable by whichever workflow mints the token: in each Home repo (reopens R38) or in one central place (candidate 3). The key "grants access to every account that the app is installed on"; GitHub suggests a key vault and sign-only use. [Best practices](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/best-practices-for-creating-a-github-app)
- **Reach by PR jobs:** Anyone who can push a workflow to a branch can read repo secrets (write-access rule). A same-repo `pull_request` job can reference `secrets.*` (inference: docs exempt only forks and Dependabot). Documented mitigation: an environment with required reviewers, or keep the key out of the Home repo.
- **Blast radius:** Bounded by the App's permissions and installed repositories, and per token by `repositories` and `permission-*`. Workflows: write plus Contents: write on a repo is effectively code execution in that repo's Actions with its secrets, so install only on the Home and Covered repos.
- **Expiry and rotation:** Tokens 1 hour; the private key has no expiry and no documented rotation interval (generate new, delete old).
- **Ownership:** Apps can be installed on personal accounts and limited to specific repositories. The pages fetched do not state who may own an App or the "only on this account" option. goal-agent is a repo, not an account, so the App would be owned by the user.

## Candidate 2: fine-grained PAT stored in each Home repo

- **Push and open PR:** Yes, with Contents: write, Pull requests: write, Workflows: write on selected repositories (`workflows` is listed with write access only). A fine-grained token has one resource owner (here `hsmejky`) and supports "Only select repositories". [Managing PATs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- **Starts workflows:** Yes (not `GITHUB_TOKEN`; the docs offer a PAT as the alternative). Same approval caveat as candidate 1.
- **Where the secret lives:** A repo secret in each Home repo, so R38 is reopened in every Home repo. Readable by any workflow in that repo, including same-repo `pull_request` jobs (inference) and anyone with write access. Narrowing to the sync workflow needs an environment with required reviewers.
- **Blast radius:** The repositories the token lists, with Workflows: write on each; it acts as the user. It becomes inactive if the user loses access.
- **Expiry and rotation:** Default 30 days via URL creation; no fixed maximum, infinite lifetime allowed unless a lifetime policy blocks it. Rotation is manual per secret. One token across repos means one leak exposes all; one token per repo means N secrets to rotate.

## Candidate 3: one secret held by a central workflow in goal-agent

- **Push and open PR:** Only if the stored secret is itself candidate 1 (App key) or 2 (PAT) covering all target repos; the central workflow adds no capability. goal-agent's own `GITHUB_TOKEN` is scoped to goal-agent only.
- **Starts workflows:** Same as the underlying credential. A `workflow_dispatch` or `repository_dispatch` into a target repo always creates a run, which helps start a workflow but does not by itself start a PR's drift check.
- **Where the secret lives:** Only in goal-agent (repo secret, or environment secret with required reviewers). Home and Covered repos hold none. A called reusable workflow receives only the secrets its direct caller names, and `secrets: inherit` works only within one org or enterprise, so a Home repo's job never receives the secret. [Reusing workflows](https://docs.github.com/en/actions/using-workflows/reusing-workflows)
- **Reach by PR jobs:** Only goal-agent's own workflows. Risk concentrates there: write access to goal-agent, or any privileged-trigger job in it, can reach the secret. Documented controls: environment approval, least-privilege `GITHUB_TOKEN`.
- **Blast radius:** The largest single point: one credential spans every Home and Covered repo with Workflows: write.
- **Expiry and rotation:** One secret to rotate (App key or PAT).

## Candidate 4: the user's own token through `gh` locally

- **Push and open PR:** Yes if the logged-in token can write workflow files (fine-grained: Workflows: write). Docs on the classic `workflow` scope were not in the pages fetched (silent). That it worked for hsmejky/goal-steward-home#14 is a local observation, not a doc fact.
- **Starts workflows:** Yes (not `GITHUB_TOKEN`).
- **Where the secret lives:** The user's machine; no repo or Actions secret exists, so R38 stays intact and no PR job or routine session reaches it unless the user exposes it.
- **Blast radius:** Whatever the user's token can write; no new surface in Actions.
- **Expiry and rotation:** Per token type (see candidate 2). Costs a manual local command per repo per sync.

## Gaps to settle by trial, not by docs

1. Whether a `pull_request` run for a PR opened by an App or PAT in the user's own repo ever lands in "approval required" (docs cover only forks and `GITHUB_TOKEN`).
2. Whether same-repo `pull_request` jobs can read repo secrets (docs exempt only forks and Dependabot).
3. Whether a personal account can hold shared cross-repo secrets (docs silent).
4. The classic PAT `workflow` scope wording.
