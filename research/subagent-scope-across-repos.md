# Can one subagent definition and its memory serve sessions in every Covered repo?

Ticket: [#31](https://github.com/hsmejky/goal-agent/issues/31), under map [#29](https://github.com/hsmejky/goal-agent/issues/29). Researched 2026-10-15 against the Claude Code docs as published that day. The installed Claude Code version was not queried; claims are tied to the docs, not a version.

## Short answer

- **Definition: yes.** A subagent in `~/.claude/agents/` (user scope) is available in every project on the machine. A plugin's `agents/` directory is available wherever the plugin is enabled. A hub repo's `.claude/agents/` is not seen from other repos unless that directory is added with `--add-dir` / `/add-dir`.
- **Memory: `memory: project` does not give one shared store.** It writes to `.claude/agent-memory/<name>/` of the project the session runs in, so each Covered repo would get its own, separate memory. `memory: user` writes to `~/.claude/agent-memory/<name>/` and is shared across all projects on the machine. `memory: local` is per project and not committed.
- **Plugins** can distribute the definition. No memory scope of their own is documented; the plugin data directory is not documented as agent memory.
- **Consequence for the design:** a cross-repo Goal agent needs `memory: user` (machine-local, shared across repos) or memory kept in a GitHub issue (the State issue), not `memory: project`.

## Findings

### 1. Where a subagent definition can live and who sees it

Source: [Subagents, "Choose the subagent scope"](https://code.claude.com/docs/en/sub-agents).

| Location | Scope | Priority |
|---|---|---|
| Managed settings | Organization-wide | 1 (highest) |
| `--agents` CLI flag | Current session | 2 |
| `.claude/agents/` | Current project | 3 |
| `~/.claude/agents/` | All your projects | 4 |
| Plugin `agents/` directory | Where plugin is enabled | 5 (lowest) |

- Same-name conflicts resolve to the higher-priority location.
- Project subagents are found by walking up from the working directory to the repository root; the closest definition wins.
- "To share subagents across projects without `--add-dir`, use `~/.claude/agents/` or a plugin." (same page)
- `--add-dir` / `/add-dir` also loads the added directory's `.claude/agents/`. Claude Code does not watch that folder, so edits need a restart. (same page)
- Plugin subagents are namespaced: `agents/review/security.md` in plugin `my-plugin` registers as `my-plugin:review:security`. ([Plugin manifest reference](https://code.claude.com/docs/en/plugins-reference) says the same: agent `reviewer` in `deploy-tools` appears as `deploy-tools:reviewer`.)

So a hub repo's definition reaches a session in another repo only via `--add-dir`, a plugin, or a copy at user scope. A project-scoped definition in each Covered repo would need N copies.

### 2. The `memory` field and where it lives

Source: [Subagents, "Enable persistent memory"](https://code.claude.com/docs/en/sub-agents).

| Scope | Location | Documented use |
|---|---|---|
| `user` | `~/.claude/agent-memory/<name>/` | learnings across all projects |
| `project` | `.claude/agent-memory/<name>/` | project-specific, shareable via version control |
| `local` | `.claude/agent-memory-local/<name>/` | project-specific, not checked in |

- `project` is the documented recommended default.
- The first 200 lines or 25 KB of `MEMORY.md` in that directory go into the subagent's system prompt; Read, Write and Edit are enabled automatically so it can maintain memory.
- Subagent memory is part of auto memory: with `autoMemoryEnabled` off or `CLAUDE_CODE_DISABLE_AUTO_MEMORY` set, the `memory` field has no effect.

The `project` and `local` paths are relative (`.claude/...`), so they belong to the project of the running session. The docs do not state which directory is used when a user-scope or plugin agent with `memory: project` runs in repo B; reading "current project" it resolves to repo B. **Unverified by test.** A cheap empirical check (spawn a user-scope `memory: project` agent in two repos, inspect where files land) would settle it.

### 3. Sharing memory across repos

- `memory: user` is the only documented subagent scope shared across projects. It lives under the user's home. The general auto-memory statement is "Auto memory is machine-local ... Files are not shared across machines or cloud environments" ([Memory](https://code.claude.com/docs/en/memory)); applying it to `~/.claude/agent-memory/` is an inference, the subagent page does not repeat it.
- `memory: project` is shareable via version control by design, so each Covered repo would carry its own copy of the agent's learnings. No documented mechanism shares one `project` memory across repos.
- Main-session auto memory (not subagent memory) is keyed per git repository and shared across worktrees: `~/.claude/projects/<project>/memory/`, with `<project>` derived from the git repo ([Memory, "Auto memory"](https://code.claude.com/docs/en/memory)). `autoMemoryDirectory` can relocate it and is read from any settings scope. Whether it also relocates `agent-memory/` is not documented; **unverified**.
- Practical sharing options: `memory: user`; or State-issue storage on GitHub (the design's existing continuity channel).

### 4. Plugins

Sources: [Plugin manifest reference](https://code.claude.com/docs/en/plugins-reference), [Subagents](https://code.claude.com/docs/en/sub-agents).

- A plugin ships agents in `agents/` (default) or via the `agents` manifest key (file paths only; replaces the default scan).
- Plugin subagents ignore the `hooks`, `mcpServers` and `permissionMode` frontmatter fields "for security reasons". `memory` is not listed as ignored, so it is presumably honoured; **not confirmed in text**.
- `${CLAUDE_PLUGIN_DATA}` (`~/.claude/plugins/data/<id>/`) survives plugin updates, but it is described for dependencies, generated code and caches, and is not tied to the `memory` field. Do not treat it as agent memory.
- A plugin enabled at user scope makes the agent available in every repo and updates in one place; the costs are the namespaced name (`<plugin>:<agent>`) and lowest priority.
- A hook in the agent's own frontmatter is ignored for plugin agents; a plugin can ship the hook in `hooks/hooks.json` (applies whenever the plugin is enabled), or the agent file can be copied to `~/.claude/agents/`.

### 5. Local evidence: `plugin-maintainer`

File: `C:\Users\hsmej\ai-plugin-manager\.claude\agents\plugin-maintainer.md` (project scope, `memory: project`, `tools: Read, Grep, Glob, Bash, WebFetch, WebSearch`, `disallowedTools: Skill`, `model: opus`). It reads `docs/agents/goal-agents.md` from its own repo and keeps memory in that repo's `.claude/agent-memory/`. That is the single-repo pattern: definition, contract and memory are all repo-local. Moving the same file to `~/.claude/agents/` keeps the definition working everywhere, but `docs/agents/goal-agents.md` would then resolve against whichever repo the session is in, and `memory: project` would split per repo.

## Implications for the cross-repo design

1. Put the definition at user scope (`~/.claude/agents/<name>.md`) or in a plugin; per-repo copies drift.
2. Do not use `memory: project` for the cross-repo agent; use `memory: user` or keep learnings in the State issue.
3. The contract file the agent reads first cannot be a repo-relative path; use an absolute path, a plugin-shipped file (`${CLAUDE_PLUGIN_ROOT}` substitutes in agent Markdown body), or inline it in the definition.
4. A hub repo's `.claude/agents/` reaches other repos only through `--add-dir`, which also lacks file watching.

## Open / unverified

- Which directory `memory: project` uses when a user-scope or plugin agent runs in a different repo than where it is defined (expected: the session's project).
- Whether `memory` frontmatter works for plugin agents (not listed as ignored).
- Whether `autoMemoryDirectory` affects `agent-memory/`.
- Behaviour of a user-scope agent in a session whose cwd is outside any git repo.
