# Glossary

## Agents

**Goal agent**:
A subagent definition that owns a long-term goal and works toward it across many sessions, keeping its continuity in durable artifacts (files, issues) rather than in conversation memory.
_Avoid_: Maintainer (one instance, not the kind), long-running agent

**Goal agent session**:
One run of a Goal agent, whether the user starts it or a schedule does; whatever the contract says about "the next session" holds for both alike.
_Avoid_: Run, routine run, tick

**Engineering skills**:
The skills of the mattpocock-skills plugin that read this repo's `docs/agents/` configuration and work through the issue tracker.
_Avoid_: Matt's skills, Pocock skills

**Objective**:
One of the aims a Goal agent's definition lists in ranked order; every issue the Goal agent files serves exactly one Objective.
_Avoid_: Priority, P-level

**Non-goal**:
Something a Goal agent's definition says it deliberately does not pursue; the agent files no issues for it, and a pull request that touches one is blocked in a Goal review.
_Avoid_: Out of scope, exclusion, anti-goal

**Order**:
The Goal agent's recommended sequence for working its open issues, derived from Objective rank and dependencies; a recommendation the user may override, never a property of a single issue.
_Avoid_: Priority, rank, urgency

**Spec-sized**:
Said of a finding too large for one fresh context window, or not verifiable on its own; it needs a spec and slices before implementation, which the user makes, never the Goal agent.
_Avoid_: Epic, large gap, big issue

**Goal agent contract**:
The rules every Goal agent follows regardless of repo: how it files issues, marks its output, keeps its State issue, and what it never writes. What varies per repo (which Goal agents exist, their labels, tracker commands) is the repo's configuration, not part of the contract.
_Avoid_: Shared contract, Goal agent rules

**Goal review**:
A Goal agent session that checks one pull request against the issues it closes and against the agent's Goal, ending in a pass or blocked verdict for the PR's current head commit. It does not judge coding standards; that belongs to code review.
_Avoid_: Maintainer review, PR review, agent code review

**Consultation**:
A question the user's session asks a Goal agent about an issue in its scope, before deciding that issue's scope, Objective, place in the Order or "done when" criteria; the agent answers with a recommendation, and the user decides.
_Avoid_: Advice brief, assessment, asking the agent

**Covered repo**:
A repository that a Goal agent's definition lists as part of its Goal; the agent works only in its Covered repos, and one Goal may span several.
_Avoid_: Project, scope repo, managed repo

**Home repo**:
The repository that holds a Goal agent's definition, State issue and memory. A cross-repo Goal agent's Home repo holds nothing else and is never one of its Covered repos; a single-repo Goal agent's Home repo is its one Covered repo.
_Avoid_: Hub, agent repo, host repo

## Goal agent state

**State issue**:
The one tracker issue per Goal agent that holds its Order, Deferred items, Checkpoints and any pending handoff note; the user reads and edits it alongside the agent.
_Avoid_: State file, state.md, dashboard

**Checkpoint**:
How far a Goal agent has processed one external source it watches (for example, the last release of a Host it has examined), so the next session resumes from there.
_Avoid_: Last seen, cursor

**Deferred item**:
Something a Goal agent has found that nobody can act on until a named external trigger fires; it is filed as an issue only after the trigger fires.
_Avoid_: Watching, parked issue, backlog item
