# Plugin route in cloud routines

Research note for [#101](https://github.com/hsmejky/goal-agent/issues/101): can a cloud routine load a Goal agent's guard hooks, agent definition and contract (as a skill) from a Claude Code plugin, instead of the committed guard copy (#100)?

Date: 2026-10-17. Branch `research/plugin-route` (never merged).

## Answers

| # | Question | Answer |
|---|----------|--------|
| 1 | Does a cloud routine install plugins declared in the Home repo's `.claude/settings.json`? | **No.** Verified by run and documented. |
| 2 | Are the plugin's hooks active before the session's first tool call (R45)? | **No**, because the plugin never loads, so its hooks never run. Committed project hooks (`.claude/settings.json` `hooks`) **are** active from the first tool call. |
| 3 | How is the plugin version pinned? | The plugin entry in `marketplace.json` takes a `sha` (`git-subdir`/`github`/`url` sources), and that pin holds (verified locally). A marketplace source takes only `ref`. In a cloud routine none of this applies, because nothing gets installed. |

Verdict: the plugin route does not work for cloud routines today. The committed guard copy stays.

## Setup

- Trial marketplace `goal-agent-trial` at `.claude-plugin/marketplace.json` on this branch, with two plugins under `trial-plugins/`:
  - `trial-repo`: a relative-path source, which follows the marketplace ref.
  - `trial-routine`: a `git-subdir` source pinned to `sha` f53d87206fc39751edc14ebe7a8adb5d84baf362. There `scripts/version` is `v1`; the branch head ed44e72 has `v2`.
- Each plugin has:
  - a SessionStart hook that appends to `/tmp/plugin-trial.log`;
  - a PreToolUse Bash guard that denies `CANARY_REPO` (trial-repo) or `CANARY_ROUTINE` (trial-routine);
  - an agent `<plugin>-agent` and a skill `<plugin>-contract`.
- Private Home-like repo `hsmejky/plugin-route-trial-home`. Its `.claude/settings.json` declares the marketplace under `extraKnownMarketplaces` (github, ref `research/plugin-route`) and enables `trial-repo@goal-agent-trial`. As a baseline, it also commits project hooks (`.claude/hooks/*.sh`) that log `project` and deny `CANARY_PROJECT`.
- Routine `trig_01N8rfLcnUGGArUgTPJPp1nS` (fired manually) runs these canaries, each as its own Bash call:
  1. `CANARY_ROUTINE`, as the very first call;
  2. `CANARY_REPO`;
  3. `CANARY_PROJECT`;
  4. a plain echo.

  It then reads the log and the plugin directory, and lists skills and agents.

## Evidence

### Route A: plugins declared in repo settings

Session `cse_01GnX1kySdtFKHCBWTHeetFq`, fired 2026-10-17T13:07:46Z, run log via `RemoteTrigger get_run_log`:

```
13:07:53.064 init: model=claude-opus-5-5 cwd=/home/user/plugin-route-trial-home
13:07:55.054 tool_use Bash: echo first-call CANARY_ROUTINE
13:07:55.158 tool_result: first-call CANARY_ROUTINE
13:07:57.342 tool_use Bash: echo second CANARY_REPO
13:07:57.431 tool_result: second CANARY_REPO
13:07:59.213 tool_use Bash: echo third CANARY_PROJECT
13:07:59.268 tool_result ERROR: PreToolUse:Bash hook error: [sh "$CLAUDE_PROJECT_DIR/.claude/hooks/guard.sh"]: Blocked by project hook: command contains CANARY_PROJECT
```

`/tmp/plugin-trial.log` holds only project-hook lines. The project SessionStart hook ran before init, and the project PreToolUse hook ran before the very first tool call:

```
2026-10-17T13:07:52.507Z SessionStart project
2026-10-17T13:07:54.936Z PreToolUse project
2026-10-17T13:07:57.258Z PreToolUse project
...
```

The plugin state in the session shows nothing installed:

- `~/.claude/plugins/installed_plugins.json` is `{ "version": 2, "plugins": {} }`;
- `known_marketplaces.json` does not exist;
- `~/.claude/plugins/synced/<org>_<account>/` is an empty account bucket;
- the environment sets `SKIP_PLUGIN_MARKETPLACE=true`.

The session listed no `trial-repo-contract` skill and no `trial-repo-agent` subagent.

The docs agree:

- [cloud-environments](https://code.claude.com/docs/en/cloud-environments), "What carries over": "Plugins and marketplaces declared in your repo's `.claude/settings.json` | No | A cloud session doesn't install the plugins a repository turns on under `enabledPlugins`, including ones from the marketplaces it lists under `extraKnownMarketplaces`". The same table lists repo-committed hooks, skills and agents as carried over.
- [plugins/loading](https://code.claude.com/docs/en/plugins/loading): "A cloud session doesn't add the marketplaces a repository lists under `extraKnownMarketplaces`, because that requires the workspace trust dialog, which a cloud session never shows."

### Route B: plugins set on the routine

The trigger object has top-level `enabled_plugins` (string array) and `extra_marketplaces` (objects with required `name` and `source`). It also has `session_request.config.account_plugins` (objects with required `plugin_id`). None of these are documented: the [routines](https://code.claude.com/docs/en/routines) docs name no plugin field.

- `update` with `{"extra_marketplaces":[{"name":"goal-agent-trial","source":{"source":"github","repo":"hsmejky/goal-agent","ref":"research/plugin-route"}}],"enabled_plugins":["trial-routine@goal-agent-trial"]}` returned HTTP 200, but both fields came back `[]`. The same happened on `create`.
- `account_plugins` can only be set through a full internal `session_request`: a partial one fails with `session_request.worker: Field required`. Also, a `plugin_id` refers to a plugin stored on the claude.ai account, not to a marketplace entry.

So routine-level plugins could not be set through the API. No second run was fired.

### Pin check (local)

This check ran in an isolated `CLAUDE_CONFIG_DIR` on Windows, with Claude Code at 2026-10-17. The commands were `claude plugin marketplace add "hsmejky/goal-agent#research/plugin-route"`, then installs of both plugins:

```
trial-routine  version f53d87206fc3-80eb7698  gitCommitSha f53d87206fc39751edc14ebe7a8adb5d84baf362  scripts/version: v1
trial-repo     version ed44e72a610e           gitCommitSha ed44e72a610eca7b5e973e7333daa51eefacabd3  scripts/version: v2
```

The `sha` on the plugin entry holds even though the marketplace ref has moved on. A relative-path plugin follows the marketplace ref head.

## Consequences

- A Home repo keeps its committed guard and hooks in `.claude/`. That is the only Home-controlled path that runs in a cloud routine, and it guards from the first tool call.
- The only documented way to bring plugins into cloud sessions is server-managed settings (claude.ai/admin-settings/claude-code, Owner role). That setting is org-wide, not per Home repo, and it was not tested here.
- If routines later honour `enabled_plugins` / `extra_marketplaces`, re-run this trial. The routine prompt and trial repo are described above, and the `sha` pin is already verified. Plugin-hook timing (Q2) would then need a fresh run: non-interactive installs run in the background, and the docs say a plugin "can be missing from the first turn" unless `CLAUDE_CODE_SYNC_PLUGIN_INSTALL=1` is set.
