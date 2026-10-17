## Project language

Write project artifacts in English, including documentation, specifications, issues, ADRs, glossary entries, research notes, code comments, commit messages, and pull request text. User-facing conversation may remain in the user's language.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on {{home}} (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.

### Goal agents

The Goal agent contract for this Home repo's agent: see `docs/agents/goal-agents.md`. Its `## Checklists` section holds the checklists for adding or removing a Covered repo and for retiring the agent.

## This Home repo

- This repo holds the `{{name}}` Goal agent (`.claude/agents/{{name}}.md`) and nothing else: no product code, and it is never one of its own Covered repos.
- Change the definition, the contract, the docs, the hooks and the workflows only through PRs. The agent pushes only `memory/`; the audit workflow halts the agent on any other commit on `main` that no merged PR brought.
- `scripts/`, `.claude/settings.json` and `.github/workflows/goal-agent-*.yml` are copies from {{owner}}/goal-agent at the definition's `goal-agent-pin`. Never edit them here: change the source in goal-agent, then recopy them and bump `goal-agent-pin` in one PR.
- The guard hooks in `.claude/settings.json` run in every Claude Code session in a clone of this repo, the user's included.
