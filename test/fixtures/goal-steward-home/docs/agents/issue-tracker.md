# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --json number,title,body,labels,comments`.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Make an issue a sub-issue of a parent**: `gh issue create --parent <parent> ...`, or `gh issue edit <parent> --add-sub-issue <child>` afterwards (`gh` 2.94+). Older `gh`: `gh api --method POST repos/<owner>/<repo>/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>` (database id, as in **Blocking** below). Without sub-issues, put `Part of #<parent>` at the top of the child body.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh api --paginate 'repos/{owner}/{repo}/pulls?state=open' --jq '.[] | select(.author_association | IN("OWNER","MEMBER","COLLABORATOR") | not) | {number, title, author: .user.login, author_association, labels: [.labels[].name]}'`.
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either: resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Read it as in **Read an issue** above.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (see **Make an issue a sub-issue of a parent**). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies**, the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only, the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.

## Goal agent operations

Used by this Home repo's Goal agent (see `docs/agents/goal-agents.md`). The
State issue (`goal-agent:state`), like `wayfinder:*` issues, is not triage
work; issues labelled `goal-agent:<name>` in the Covered repos are. Use
`gh api` only; `gh issue` and `gh pr` fail in a cloud session. Call
`add_repo` for a Covered repo before the first call to it.

`<home>` is this repo, `hsmejky/goal-steward-home`; `<repo>` is a Covered repo;
both as `owner/repo`. `<name>` is the agent's name, `goal-steward`.

- **Labels**: `goal-agent:state` here; `goal-agent:<name>` in every Covered
  repo. Never create a label; a missing one is a blocker (stop and report).
- **Find the State issue**: `gh api "repos/<home>/issues?labels=goal-agent:state&state=open" --jq '.[] | select(.title | contains("<name>")) | .number'`.
  None: create it. More than one: stop and report.
- **Create the State issue**: `gh api repos/<home>/issues -f title="<name> Goal agent: state" -f labels[]=goal-agent:state -F body=@<file>`
  with the sections `## Order`, `## Deferred items`, `## Checkpoints`,
  `## Progress`.
- **Update the State issue**: `gh api repos/<home>/issues/<n> --jq '.body,.updated_at'`,
  compute, re-read, then `gh api -X PATCH repos/<home>/issues/<n> -F body=@<file>`
  and re-read to verify.
- **Comment, or edit an own comment** (`Last run`): `gh api repos/<repo>/issues/<n>/comments -F body=@<file>`;
  `gh api -X PATCH repos/<repo>/issues/comments/<id> -F body=@<file>`.
- **Issues in scope**: `gh api --paginate "repos/<repo>/issues?labels=goal-agent:<name>&state=open"`
  (drop entries with a `pull_request` key).
- **Search for a duplicate**: `gh api --paginate "repos/<repo>/issues?state=all"`
  per Covered repo, matched on title and body.
- **File a Finding**: `gh api repos/<repo>/issues -f title=... -F body=@<file> -f labels[]=needs-triage -f labels[]=<bug|enhancement> -f labels[]=goal-agent:<name>`.
- **Close an own issue before triage**: post the marked comment, then
  `gh api -X PATCH repos/<repo>/issues/<n> -f state=closed`.
- **Blocking edges** between your own flat issues:
  `gh api repos/<repo>/issues/<n>/dependencies/blocked_by -F issue_id=<blocker id>`;
  read them with `gh api repos/<repo>/issues/<n>/dependencies/blocked_by`
  and each blocker's `state`, never `issue_dependencies_summary`.
- **Read a file by path**: `gh api repos/<repo>/contents/<path> --jq .content | base64 -d`.
- **Goal review: read the PR**: `gh api repos/<repo>/pulls/<n>` (body, `head.sha`,
  `draft`), `gh api --paginate repos/<repo>/pulls/<n>/files`, and each closing
  issue with `gh api repos/<repo>/issues/<m>` and
  `gh api --paginate repos/<repo>/issues/<m>/comments`.
- **Goal review: post the verdict**: list `gh api --paginate repos/<repo>/issues/<n>/comments`
  again, then `gh api repos/<repo>/issues/<n>/comments -F body=@<file>`.
- **Merged PRs since a time**: `gh api "repos/<repo>/pulls?state=closed&sort=updated&direction=desc"`
  (keep `merged_at` after it).
