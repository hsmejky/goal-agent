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
