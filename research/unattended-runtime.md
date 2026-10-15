# Where can a Goal agent run unattended across several repos?

Research for issue #30 (map #29). Retrieved 2026-10-15. All claims come from official docs; "UNVERIFIED" marks gaps.

Sources:
- [Routines](https://code.claude.com/docs/en/routines)
- [Cloud sessions](https://code.claude.com/docs/en/claude-code-on-the-web)
- [Cloud environments](https://code.claude.com/docs/en/cloud-environments)
- [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions)
- [Headless / `claude -p`](https://code.claude.com/docs/en/headless)
- [Desktop scheduled tasks](https://code.claude.com/docs/en/desktop-scheduled-tasks)
- [Authentication](https://code.claude.com/docs/en/authentication)
- [Memory](https://code.claude.com/docs/en/memory)
- GitHub Docs: [GITHUB_TOKEN](https://docs.github.com/en/actions/concepts/security/github_token), [workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows), [limits](https://docs.github.com/en/actions/reference/limits)

## Short answer

All three can run unattended. Only the cloud routine runs several repos in one session out of the box, bills against the subscription, and needs no machine of yours. GitHub Actions is natively one-repo (cross-repo needs a PAT or custom GitHub App token). A local scheduler gives the most control but depends on your machine being on.

## Comparison

| Dimension | Cloud routine (`/schedule`) | GitHub Actions (`claude-code-action`) | Local scheduler (Desktop task, or OS cron + `claude -p`) |
|---|---|---|---|
| Unattended | Yes. Full cloud session, no permission-mode picker, no approval stops. | Yes, with a `prompt` input (automation mode). | Desktop task: only while the app is open and the computer awake; a sleeping machine skips the run. OS cron + `claude -p`: yours to keep running. |
| Triggers | Schedule (min 1 hour), API POST, GitHub PR/release events. | Any workflow event; cron (min 5 min, may be delayed, default branch only). | Desktop: min 1 minute. `-p`: anything you wire up. |
| Multi-repo checkout | "One or more repositories", each cloned on every run, default branch. | Workflow checks out its own repo; extra repos need extra `actions/checkout` steps with a cross-repo token. | Whatever is on disk; `--add-dir` for several folders in `-p`; a Desktop task takes one working folder. |
| Push | `claude/`-prefixed branches by default, other branches if the prompt says so. The git proxy rejects branch deletions and non-branch pushes but does not limit which branch; use branch protection. | Via the Claude GitHub App token (repos where installed); `GITHUB_TOKEN` is limited to the workflow's own repo. | Your own git credentials. |
| GitHub auth and scopes | Claude GitHub App (installed repos) or `/web-setup` (sends local `gh` token; any repo that token can reach). Credentials stay on Anthropic servers; the VM sees only a scoped proxy credential. Commits and PRs carry your GitHub user. | Claude GitHub App (Contents, Issues, PRs read/write; the shared app also holds Actions, Workflows, Checks etc.) or a custom app. `GITHUB_TOKEN` permissions are "limited to the repository that contains your workflow". Cross-repo: PAT or GitHub App installation token (GitHub docs). | Local `gh`/git credentials; full control of scopes. |
| Billing | Subscription usage, same as interactive. Overage only with usage credits on. No separate VM charge. | `ANTHROPIC_API_KEY` (API tokens) or `CLAUDE_CODE_OAUTH_TOKEN` (subscription; from `claude setup-token`, valid one year). Plus GitHub Actions minutes. | Subscription login or API key. |
| Memory persistence | Fresh clone each session; only committed files carry over. Idle VM pauses with files saved and may be reclaimed. Auto memory in routine sessions: UNVERIFIED (docs say on by default in local sessions, off by default in self-hosted environments, silent on Anthropic-hosted cloud). | Fresh runner per run; nothing persists unless committed, cached or stored in GitHub. `--bare` skips CLAUDE.md and auto memory. | Auto memory persists on disk at `~/.claude/projects/<project>/memory/`, shared across worktrees of one repo. |
| Limits | 100 scheduled runs/hour per account; 30/hour per routine for Run now and API; 100/hour per account for API fires; GitHub event triggers have hourly caps (figures not stated). Shares account rate limits. Top-of-hour starts can be minutes late. Research preview: limits may change. | Job max 6 hours; `GITHUB_TOKEN` 1,000 API requests/hour/repo; concurrent jobs by plan (Free 20, Team 60, Enterprise 500); scheduled workflows disabled after 60 days of inactivity on public repos. | Desktop: one catch-up run for runs missed in the last 7 days; no cloud timeouts. |
| Other constraints | Needs a claude.ai subscription login (Console API key, Bedrock etc. cannot use `/schedule`). Routines belong to one personal account, not shared. Unavailable with Zero Data Retention. Default network is an allowlist ("Trusted"). Skips runs, then turns off after 72 hours without a GitHub connection. | Bot actors rejected unless in `allowed_bots`; scheduled runs are attributed to the last user who edited the cron line. Events created with `GITHUB_TOKEN` do not trigger other workflows. | Permission prompts stall a Desktop task unless pre-approved (`--permission-prompts none` exists for `-p`). `CLAUDE_CODE_OAUTH_TOKEN` can only make model requests. |

## Findings per runtime

### Cloud routine

- A routine is a saved prompt plus repositories plus connectors; triggers are schedule, API and GitHub events. Runs are cloud sessions that need no approval, apart from some artifact actions.
- Multi-repo is a first-class setting. Each added repo is cloned every run. Skills committed to the repos are available.
- Writes to GitHub: cloud sessions include built-in GitHub tools that "read issues, list pull requests, fetch diffs, and post comments" through the proxy, using the method you connected. Whether they create issues or reach repos not attached to the routine: UNVERIFIED.
- The routine acts as you: commits, PRs and replies carry your GitHub identity.
- Memory: no documented persistent per-routine memory. The durable store is the repos and GitHub issues, which fits a State issue.
- Minimum cadence is hourly; nothing here supports sub-hour polling.

### GitHub Actions

- Strongest fit for event-driven work inside one repo (comments, PRs). Scheduled runs work but only from the default branch.
- Auth is the main cost across several repos: the default token is scoped to one repo, so a Goal spanning Covered repos needs a PAT or GitHub App installation token. For a shared secret the docs recommend an API key, since an OAuth token is tied to the person who ran `setup-token`.
- Billing: API tokens (or subscription via OAuth token) plus Actions minutes.
- Memory: ephemeral runners; only what is written to GitHub or committed.

### Local scheduler

- Desktop scheduled tasks: local files, per-task permission mode, optional worktree; run only while the app is open and the machine awake; missed runs get one catch-up. Cloud routines do not require your machine on.
- `claude -p` from OS cron or Task Scheduler: full control, `--add-dir` for several repos, `--permission-mode` and `--permission-prompts none` for unattended use, `--continue`/`--resume`, auto memory on disk. Auth: subscription login or `CLAUDE_CODE_OAUTH_TOKEN` (not with `--bare`, which needs an API key).
- Cost: dependence on one machine's uptime and credentials.

## Gaps (UNVERIFIED)

- Whether a routine session can create issues and comments in every attached repo with the connected GitHub method (tools are described only generally).
- Whether auto memory is active in Anthropic-hosted cloud/routine sessions.
- Numeric caps for GitHub-event triggers.
- Exact subscription-usage cost of a routine run (docs say only "same as interactive").
- Whether the `/web-setup` token reaches Covered repos across several GitHub accounts or orgs (it follows the `gh` token's access).
