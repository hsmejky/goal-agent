# Glossary

## Agents

**Goal agent**:
A subagent definition that owns a long-term goal and works toward it across many sessions, keeping its continuity in durable artifacts (files, issues) rather than in conversation memory.
_Avoid_: Maintainer (one instance, not the kind), long-running agent

**Engineering skills**:
The skills of the mattpocock-skills plugin that read this repo's `docs/agents/` configuration and work through the issue tracker.
_Avoid_: Matt's skills, Pocock skills

**Objective**:
One of the aims a Goal agent's definition lists in ranked order; every issue the Goal agent files serves exactly one Objective.
_Avoid_: Priority, P-level

**Order**:
The Goal agent's recommended sequence for working its open issues, derived from Objective rank and dependencies; a recommendation the user may override, never a property of a single issue.
_Avoid_: Priority, rank, urgency

**Spec-sized**:
Said of a finding too large for one fresh context window, or not verifiable on its own; it needs a spec and slices before implementation, which the user makes, never the Goal agent.
_Avoid_: Epic, large gap, big issue

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
