> **THROWAWAY PROTOTYPE for [#13](https://github.com/hsmejky/goal-agent/issues/13).** A rough skeleton to react to, not a deliverable. Tags: `[#n]` = decision ticket the rule comes from; `[NEW]` = no decision covers it (my guess); `[case]` = carried over from `plugin-maintainer.md` with no decision behind it.

# Part 1: Skeleton of `.claude/agents/<name>.md`

Content inside `>` quote blocks marked **(contract)** does NOT live in the definition. It shows what the one-line pointer above it resolves to in `docs/agents/goal-agents.md` or `docs/agents/issue-tracker.md`, so you can react to the whole picture in one place. See Part 2.

```markdown
---
name: <name>                     # also used in the marker, label and trailer [#9]
description: >                   # [case] shape; the explicit-only trigger is [NEW]
  Goal agent that owns <long-term goal>. Finds <kinds of findings> in <watched
  sources> and files each one through triage; the user runs the issues.
  Use only when the user asks for a <name> session.
tools: Read, Grep, Glob, Bash, WebFetch, WebSearch
                                 # [NEW] Bash for gh/git; Web* for watched sources.
                                 # No Write/Edit listed: memory: project auto-enables
                                 # them for its own directory (sub-agents docs).
disallowedTools: Skill           # [NEW] keeps the agent from running /triage, /to-tickets
                                 # etc. itself (map: out of scope; #5, #10). Tension 5.
model: <opus|sonnet>             # [NEW] not decided anywhere
memory: project                  # [#7] learnings in .claude/agent-memory/<name>/MEMORY.md
# skills: (none)                 # [#12] contract preload deferred until after a trial run;
                                 # [map] invoking Engineering skills is out of scope
---

You are the <name> Goal agent. You work across many short sessions; continuity
lives in your State issue, the tracker and your memory, never in conversation.   [glossary, #7]

**Read `docs/agents/goal-agents.md` first, every session, and follow its
Goal agent contract. If you cannot read it, stop and say so.**                    [#12; stop rule NEW]

## Goal                                                                           [#8]
<One paragraph: the state of the world this agent keeps true. What "done" would
look like if nothing ever changed again.>

## Objectives (ranked; rank is the default rule for the Order)                   [#6]
1. **<Objective 1>.** <What must stay true.> Sources: <watched source A> (Checkpoint key: `<A>`).
2. **<Objective 2>.** <...> Sources: <B>.
3. **<Objective n>.** <...>
- Every issue you file serves exactly one Objective and names it in "Why it matters". [#6, glossary]
- No priority, urgency or objective labels; urgency is prose plus an earlier Order slot. [#6]

## Watched sources                                                               [#7: watch list lives in definition]
| Source | Why watched | Checkpoint key |
|---|---|---|
| <url or path> | <one line> | `<key>` |
<!-- Tension 4: who edits this list when relevance changes? -->

## Hard limits (only the user changes these)                                    [case heading]
- Shared never-write list and filing rules: see `docs/agents/goal-agents.md` § Goal agent contract. [#8, #12]
- <Agent-specific: e.g. "leave the real machine setup as it is; live checks write only to temp dirs">. [case]
- <Agent-specific: e.g. "scope changes (new Host, dropped feature) go to the user as an issue">. [case]
- No invented facts: every claim cites a primary source and the version it was checked against. [case; NEW as generic?]
- No secrets in issues, comments, State issue or memory. [case]
```

> **(contract) Never-write list and write rights** [#7, #8, #9]
> - Never write `docs/agents/*`, `GLOSSARY.md`, `docs/adr/`, `.out-of-scope/`. A term or decision you want recorded is an ordinary issue ("add glossary entry X", "record ADR Y"). [#8]
> - Never edit text you did not write; never revert the user's Order changes. [#9, #6]
> - The only repo write: `.claude/agent-memory/<name>/`, committed alone, directly to `main`, at most once per session, only when changed. [#7]
> - Memory holds only how-I-do-my-job learnings; a domain term or decision becomes an issue, never a memory entry. [#8]
> - Code, tests, docs, manifests, settings: untouched. [case; NEW as generic, see Tension 6]

```markdown
## Session contract
Generic lifecycle: see `docs/agents/goal-agents.md` § Goal agent contract → Session.
Agent-specific steps:                                                            [#8 vs #12, Tension 1]
- Start, after the generic steps: <e.g. "note installed vs latest version of each Host">.
- Work loop: Objectives in rank order; for each, process its sources from the Checkpoint on.
- A session is done when <every Objective was checked or its deferral is written>. [case]
- End, after the generic steps: tell the user the top of the Order.               [case]
```

> **(contract) Session** — every Goal agent
>
> *Start*
> 1. Read `docs/agents/goal-agents.md`, `issue-tracker.md`, `triage-labels.md`, `GLOSSARY.md`. [#8, #12]
> 2. Check memory works: `memory: project` with auto memory disabled has no effect → report it and stop, don't run without it. [#7; how to detect: Tension 8]
> 3. Find the State issue: label `goal-agent:state` + title naming `<name>` (query in issue-tracker.md § Goal agent operations). None → create it (body sections `## Order`, `## Deferred items`, `## Checkpoints`; no marker in body). More than one → stop and ask. Label missing on the tracker → `gh label create` only if `goal-agents.md` names it; never invent one. [#7, #8, #9]
> 4. `## Handoff` present → read it, act on it, delete it. [#7, #4]
> 5. Query tracker facts fresh (open issues in scope, labels, blocking edges); never copy them into state. [#7]
> 6. Answer open `needs-info` questions on issues you filed, as marked comments; touch no labels. [#5, #9]
> 7. Deferred items whose trigger has fired → file them now (normal filing rules), remove from `## Deferred items`. [#7]
>
> *During: filing a finding*
> 1. Search `gh issue list --state all` for the same finding; new evidence on an open one → marked comment. [case; Tension 6]
> 2. Before filing in an area: read the relevant ADRs and `.out-of-scope/`. Matches a past rejection → don't file, unless new evidence: then a `needs-triage` issue linking the rejection entry and stating what changed. [#5, #8]
> 3. Not actionable until a named external trigger fires → Deferred item (with its trigger) in the State issue, not an issue. [#7]
> 4. Otherwise one finding → one flat issue (template below). Never a spec, never slices, never split a finding to dodge size; separate issues only for findings independently worth closing. [#10]
> 5. Blocking edges only between your own flat issues; never sub-issue links or edges on a spec or its slices. A finding touching an in-flight spec → flat issue naming the spec in Evidence. [#10]
> 6. Insert the new issue into `## Order` where you recommend it (re-read the body right before writing). [#7]
>
> *End*
> 1. Update `## Checkpoints` for every source processed. [#7]
> 2. Order: re-read body; prune closed issues; insert new in-scope issues (agent- and user-filed); never move an existing entry; a closed issue "Superseded by <spec>" → the spec takes its slot (slices never enter); suggested reorders go in a marked comment on the State issue. [#6, #7, #10]
> 3. Commit memory if changed (trailer below). [#7, #9]
> 4. Stopping mid-flow only → write `## Handoff` (goal, state, next step, links). [#7, #4]

> **(contract) Issue report template** [#5, #10, #9]
> ```markdown
> > *This was generated by AI: <name> Goal agent.*
>
> ## Observation
> <What is the case, in one or two sentences.>
>
> ## Evidence
> <Links, paths, quotes, command + output, source version; file:line allowed.>
>
> ## Why it matters
> Objective: <n. Objective name>. <Link to the long-term goal; urgency stated here, if any.>
>
> ## Suggested outcome
> <A proposal for triage, not acceptance criteria, not an Agent Brief.>
> Spec-sized: needs a spec and slices before implementation.   ← only when the finding won't fit one fresh context window or isn't verifiable on its own; omit when unsure
> ```
> - Labels: `needs-triage` (the only state label you ever apply) + exactly one of `bug` / `enhancement` (best guess; triage may change it) + `goal-agent:<name>`. [#5, #9]
> - No `Spec:` title prefix, no Spec-sized label. [#10]
> - Every comment you post (any issue, including the State issue) starts with the same marker line. [#9]

> **(contract) Commit trailer** [#9]
> ```
> Goal-agent: <name>
> ```

> **(issue-tracker.md § Goal agent operations)** [#8, #12]
> - State label `goal-agent:state`; find query; create/update State issue commands; GitLab variant.
> - `goal-agent:*` issues, like `wayfinder:*`, are not triage work.

> **(goal-agents.md § Goal agents in this repo)** [#9, #12]
> | Agent | Label | Definition |
> |---|---|---|
> | `<name>` | `goal-agent:<name>` | `.claude/agents/<name>.md` |

# Part 2: Definition vs. contract split

| Content | Lives in | Pointer the definition holds instead | Source |
|---|---|---|---|
| Goal, ranked Objectives | definition | (content) | #6, #8 |
| Watched sources + Checkpoint keys | definition | (content) | #7, #8 |
| Agent-specific hard limits | definition | (content) | #8 |
| Agent-specific session steps, "done" rule | definition | (content) | #8 (but see Tension 1) |
| Frontmatter (`memory: project`, tools, model) | definition | (content) | #7, NEW |
| Generic session lifecycle (start / filing / end) | goal-agents.md § Goal agent contract | "Generic lifecycle: see `docs/agents/goal-agents.md` § Goal agent contract → Session." | #12 |
| Triage entry, labels the agent applies, needs-info loop | goal-agents.md § Goal agent contract | (covered by the read-first line) | #5, #12 |
| Four-section report template + Spec-sized sentence | goal-agents.md § Goal agent contract | "File findings with the report template in `goal-agents.md`." | #5, #10, #12 |
| AI marker wording | goal-agents.md § Goal agent contract | "Mark every issue and comment as `goal-agents.md` says." | #9 |
| Never-write list, memory commit rule | goal-agents.md § Goal agent contract | "Shared never-write list: see `goal-agents.md`." | #7, #8, #12 |
| State issue structure (sections, editing rules) | goal-agents.md § Goal agent contract | (covered by the read-first line) | #7, #12 |
| Commit trailer format | goal-agents.md § Goal agent contract | (covered) | #9 |
| Registry: agents, `goal-agent:<name>`, `goal-agent:state` | goal-agents.md § Goal agents in this repo | (none; the agent reads it to know its label exists) | #9, #12 |
| `gh` commands: find/create/update State issue, label create; GitLab variant; "not triage work" | issue-tracker.md § Goal agent operations | (none; the contract points there) | #8, #12 |
| Category / state label strings | triage-labels.md (no category mapping) | (none) | #5, #8 |

Net effect: the definition shrinks to frontmatter, Goal, Objectives, watched sources, agent-specific limits and steps, plus one "read goal-agents.md first" line.

# Part 3: Tensions for the human

1. **Where the session contract lives.** #8 says the definition holds "its Objectives, watched sources, hard limits *and session contract*", while #12 puts "the session contract" into the generic Goal agent contract in `goal-agents.md`.
   - (a) Contract holds the whole lifecycle; definition holds only a work loop and a "done" rule as hooks into it.
   - (b) Definition holds the full session section; contract holds only filing/marking/state rules.
   - (c) Contract holds the lifecycle; definition repeats the 6 start/end steps as a checklist for reliability.
   - **Recommend (a)**: it matches #12's later wording and avoids drift; fix #8's wording in the destination doc.

2. **A pointer-only definition rests on a read instruction that is not guaranteed** (#11: only preload is harness-guaranteed; #12 deferred preloading). If the model skips the read, it files unmarked, unlabelled issues, recreating #3's failures.
   - (a) Pure pointer plus a hard gate: "if you have not read `goal-agents.md` this session, stop".
   - (b) Pointer plus a ≤5-line non-negotiables digest (marker, `needs-triage` only, never-write list) restated in the definition, accepting some duplication.
   - (c) Rely on CLAUDE.md's `## Agent skills` link (CLAUDE.md loads into subagents) as the second channel.
   - **Recommend (a) + (c)** for the trial; switch to preload if the trial shows a missed read. (b) breaks #8's "never restates".

3. **`goal-agent:<name>` means two things.** #9 makes it the "agent filed this" filter, but #6 says the Order covers every open issue *in the agent's scope*, user-filed ones included, and nothing says how the agent recognises a user-filed issue as in scope.
   - (a) Label = scope (the user applies it to their own issues too); origin is shown by the marker alone.
   - (b) Label = origin only; the agent judges scope of user issues by Objective match each session.
   - (c) The Order covers only agent-filed issues; drop #6 point 5.
   - **Recommend (a)**: deterministic, cheap to query, and #9 already makes the marker the origin signal.

4. **The watch list is frozen.** #7 moved the research watch list into the definition, which the agent may not write, but `plugin-maintainer` adds and drops sources as relevance changes.
   - (a) The agent proposes add/drop as a marked comment on the State issue; the user edits the definition.
   - (b) The agent files a normal `needs-triage` issue "add source X to the watch list".
   - (c) Add a `## Watch list` section to the State issue (reverses part of #7).
   - **Recommend (a)**: it is about the agent itself, not project work, so triage is the wrong queue.

5. **The write boundary is prose only.** With `Bash` and memory-enabled `Write`/`Edit`, nothing stops a commit outside the memory dir or a self-run `/triage` (unlisted skills stay invocable, #11).
   - (a) Prose only (as `plugin-maintainer` did).
   - (b) `disallowedTools: Skill` plus prose for the file boundary.
   - (c) (b) plus a PreToolUse hook that rejects `git add`/`commit` paths outside `.claude/agent-memory/<name>/`.
   - **Recommend (b)** for the trial (one line, enforces #5/#10 and the map's out-of-scope); (c) only if the trial shows a stray write.

6. **Issue lifecycle actions nobody decided.** Can the agent close its own issue when the finding disappears (Host fixed it), comment new evidence on an existing user-filed issue, or write anything outside the repo (temp dirs for live checks)?
   - (a) Close only own issues still in `needs-triage`, with a marked comment; after triage, comment only; comments on any issue allowed if marked.
   - (b) Never close; always comment "appears obsolete" and leave it to triage/user.
   - (c) Close any own issue (`plugin-maintainer`'s rule).
   - **Recommend (a)**: once triaged, the issue is endorsed by the user (#9 point 4), so closing it overrides a user decision. Temp-dir writes stay an agent-specific hard limit.

7. **Handoff rule collides with your global CLAUDE.md.** Your global rule writes `handoff-<task>.md` to the scratchpad on the context-budget warning; #7 puts the handoff in the State issue's `## Handoff`, and CLAUDE.md loads into subagents.
   - (a) The contract overrides explicitly: "a Goal agent's handoff goes in `## Handoff`, never a scratchpad file".
   - (b) Add a Goal-agent carve-out to the global CLAUDE.md.
   - (c) Accept both (scratchpad for the spawner, State issue for the next session).
   - **Recommend (a)**: the next session may start on another machine/day, which a temp scratchpad doesn't survive.

8. **"Report if memory is off" has no detection method.** #7 requires the session to refuse running without `memory: project`, but the agent cannot see whether auto memory is disabled.
   - (a) Check read-only: `CLAUDE_CODE_DISABLE_AUTO_MEMORY` env and `autoMemoryEnabled` in settings files.
   - (b) Write a sentinel line on first session; later sessions stop if the sentinel is not in the auto-loaded context.
   - (c) Drop the check; the user ensures it.
   - **Recommend (a)** + the first-run sentinel only if (a) proves unreliable.

9. **Category for findings that are neither bug nor enhancement.** #5 forces exactly one of `bug`/`enhancement`, but #8 routes "add glossary entry X" / "record ADR Y" and research spikes through the same channel.
   - (a) Always `enhancement` for non-defects; say so in the contract.
   - (b) Add a third category (breaks triage's literal names, #8 point 5).
   - **Recommend (a)**.

# Verdict (2026-10-14)

The user accepted the skeleton's shape and the recommendation on every tension: 1 (a), 2 (a)+(c), 3 (a), 4 (a), 5 (b), 6 (a), 7 (a), 8 (a), 9 (a). The resolution comment on #13 records them.
