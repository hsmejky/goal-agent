---
status: accepted, amended by R18
---

# A cross-repo Goal agent lives in a dedicated Home repo

A Goal agent whose Goal spans several Covered repos keeps its definition (`.claude/agents/<name>.md`), its State issue and its memory (`.claude/agent-memory/<name>/`; amended, see [Amendments](#amendments)) in a dedicated Home repo, one per agent, that is not itself a Covered repo. The Home repo is set up like any repo with the Engineering skills and is the only source of the contract the agent follows. The agent runs unattended as a cloud routine that attaches the Home repo and every Covered repo. The routine's prompt is only a pointer: read the definition and the contract it links, act as that agent, and push memory to the Home repo's `main`. We chose a dedicated repo because it favours no Covered repo, keeps the agent's State issue and memory commits out of their trackers and history, and does not move when a Covered repo is added or removed.

## Considered Options

- **One of the Covered repos as home**: one repo fewer, but that repo's tracker and `main` carry the agent's state, and removing it from the Goal means moving the agent.
- **User level** (`~/.claude/agents/`, `memory: user`): rejected because a cloud routine starts from fresh clones on a fresh VM, so nothing under `~/.claude` exists or persists in an unattended run.
- **This `goal-agent` repo as a shared home**: rejected because it mixes the design of the pattern with a live instance of it.

## Consequences

- In a multi-repo cloud session the working directory is above the clones, so the Home repo's `.claude/` settings, hooks and frontmatter are not relied on. The agent reads and writes its memory files explicitly, and limits set only in frontmatter (`disallowedTools: Skill`, `tools`) are not enforced in unattended runs; they must be bounded by the contract and other safeguards.
- The routine pushes memory directly to the Home repo's `main`, since its prompt names that branch.
- Memory holds only lessons that apply across the Goal and never names a Covered repo, so adding or removing a Covered repo never makes it stale. Facts about one repo live in the definition's Covered repo list, the State issue, or that repo's own docs.
- In cloud sessions `gh issue` and `gh pr` fail (GraphQL is blocked); tracker operations use `gh api` REST, and only attached repos are reachable.
- A user session opened in the Home repo can still spawn the agent as an ordinary subagent.

## Amendments

- **Memory path, amended by [R18][r18] (issue [#82][i82]).** The agent's memory is plain files in the Home repo's `memory/`. This replaces `.claude/agent-memory/<name>/` named above.

[r18]: ../goal-agents-with-engineering-skills.md#r18
[i82]: https://github.com/hsmejky/goal-agent/issues/82
