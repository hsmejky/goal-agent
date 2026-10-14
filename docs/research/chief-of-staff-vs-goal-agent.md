# chief-of-staff and claude-handoff vs. a Goal agent

Research for ticket #4 (map #1). Snapshot dated 2026-10-14, mattpocock-skills 1.3.1.
Both skills live under `skills/in-progress/`, so they are unstable and may change or vanish.
Skill root below: `~/.claude/plugins/cache/mattpocock/mattpocock-skills/1.3.1/skills/`.

Note on the Goal agent definition: `GLOSSARY.md` does not exist on `main` or in this worktree at the time of writing. The definition used here is map #1's Notes: "Goal agent = subagent with a long-term goal, continuity in files/issues." (unverified against the glossary).

## 1. What each does

### chief-of-staff (`in-progress/chief-of-staff/SKILL.md`)

- Front matter: `description: Pursue a long-running goal in a single session by co-ordinating subagents.` and `disable-model-invocation: true` (user-triggered only; `agents/openai.yaml` sets `allow_implicit_invocation: false`).
- **Model of long-running work:** one very long main session. "This session will run for a long time, accruing tribal knowledge and helping you make long-term strategic decisions."
- **State:** no state file. State is the session's own context ("accruing tribal knowledge") plus "context pointers: research notes, previous commits, and others". Nothing says what happens when the session ends or compacts.
- **Sessions:** a single session. It delegates: "All work should be done in subagents. Protect your context window." and "Use background agents so you can stay in active dialogue with the user."
- **Handoff:** none inside the skill. Subagent communication "should be sparse", via "context pointers", and "Don't duplicate information already available via pointers."
- **Who decides:** the chief of staff: "You are the Directly Responsible Individual for this goal." The user is in "active dialogue", and "Use every user message as an excuse to search for these improvements."
- **Strategic layer:** every task has two tracks: "Tactical: how do I complete the immediate task?" and "Strategic: how do I modify the environment to improve the outcomes of the _next_ task?" Improvements named: constrained APIs, lint rules, `CODING_STANDARDS.md`, data sources (logs, test DBs, browser), and the "no workarounds" rule.
- **Schedules:** "Harness-permitting, you will suggest recurring schedules" (suggest only; no mechanism given).

### claude-handoff (`in-progress/claude-handoff/SKILL.md`)

- `description: Hand the current conversation off to a fresh background agent that picks up the work immediately.` Also `disable-model-invocation: true`.
- **Model:** relay between sessions. Write a summary file in the OS temp dir, then launch `claude --bg --name "<descriptive name>" -- "$(cat <summary file>)"`. "It starts in the current working directory and returns immediately; the user manages it with `claude agents`."
- **State:** the handoff summary only, and it becomes the new agent's prompt. "Do not duplicate content already captured in other artifacts (specs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead."
- **Handoff contents:** a "suggested skills" section; redaction ("since the summary becomes the agent's prompt").
- **Who decides:** the outgoing agent decides what to hand over; the user triggers it and manages the job afterwards.

### productivity/handoff (`productivity/handoff/SKILL.md`, comparison)

Same as claude-handoff but only writes the document "to the temporary directory of the user's OS ... not the current workspace"; the user starts the next session. The same no-duplication, suggested-skills and redaction rules apply. claude-handoff is this skill plus automatic launch.

### plugin-maintainer (`~/ai-plugin-manager/.claude/agents/plugin-maintainer.md`, comparison)

- Model: a subagent definition run manually in many short sessions. "You work across many sessions; each one builds on `state.md` and the GitHub issues, not on memory."
- State: a committed `state.md` (Hosts, Watching, Watch list, What next) plus GitHub issues.
- Handoff: none needed; the next session reads `state.md`. "A session that ends without an updated `state.md` and an issue for every gap it found is failure."
- Who decides: the user. "You track and file; the user runs the issues." "The user decides scope." Hard limits: "Write only `state.md` and issues".
- Schedule: "The user starts you manually ... Nothing may depend on a session running soon: the default without a session is 'do nothing'."

## 2. Platform facts (official docs)

- Project subagents live in `.claude/agents/` and can be checked in ([sub-agents](https://code.claude.com/docs/en/sub-agents)).
- "Each subagent starts with a fresh, isolated context window. It doesn't see your conversation history" (fork excepted).
- Persistence is opt-in: the `memory` frontmatter field "gives the subagent a persistent directory that survives across conversations" (`.claude/agent-memory/<name>/` for project scope). It has no effect if auto memory is off. Transcripts expire after `cleanupPeriodDays` (30 default).
- Nesting: "By default, a subagent can spawn subagents of its own, up to three layers below the main conversation." Omit `Agent` from `tools` to stop it.
- Background subagents prompt for permissions in the main session and "run with a smaller built-in tool set than foreground subagents."
- `claude --bg`: "Pass `--bg` ... to start a session that goes straight to the background"; `--name` sets the display name; `claude agents` opens agent view ([agent-view](https://code.claude.com/docs/en/agent-view)). The prompt is positional; `--bg` with `-p` is rejected.
- Background sessions are local: "preserved across sleep but stop if the machine shuts down." A finished or waiting session unattached for about an hour has its process stopped by the supervisor (pinning with Ctrl+T keeps it running).
- Only the first 100000 characters of each docs page were read; the tail was not checked (unverified there).

## 3. Overlap and contradiction with the Goal agent concept

| Aspect | chief-of-staff | claude-handoff | Goal agent (map #1 / plugin-maintainer) |
|---|---|---|---|
| Form | main session acting as role (skill) | skill that spawns a session | subagent definition in `.claude/agents` |
| Lifetime | one long session | chain of sessions | many short sessions |
| Continuity | in-context "tribal knowledge" | one-shot summary prompt | files and issues (`state.md`, GitHub) |
| Who does work | subagents it spawns | the next agent | user runs issues; agent files them |
| Trigger | user | user | user (manual); no session = do nothing |

**Overlap**
- Long-term goal with a single owner ("Directly Responsible Individual" vs. the Goal in plugin-maintainer).
- Pointer discipline: "context pointers" and "Reference them by path or URL" match "continuity in files/issues".
- Strategic track: improving the environment for the next task resembles plugin-maintainer's gap detection and Objective 3 (docs match reality) and Objective 4 (research ahead of need).
- Delegation to protect context.

**Contradictions**
1. Continuity: chief-of-staff keeps knowledge in one session's context; the Goal agent states "each one builds on `state.md` and the GitHub issues, not on memory". Context is lost at compaction, crash, machine shutdown, or the idle supervisor stop (sessions are local).
2. Autonomy: chief-of-staff does the work through subagents and decides; the Goal agent only files issues, and the user runs them (hard limits).
3. Cadence: chief-of-staff assumes an always-on session and suggests schedules; plugin-maintainer assumes manual starts and "the default without a session is 'do nothing'". Handoff relies on `claude --bg`, a local-only feature with a local supervisor.
4. Form: chief-of-staff and handoff are `disable-model-invocation` skills, not agent definitions. They cannot define hard limits, tools or model the way `.claude/agents/*.md` can. The Goal agent is a subagent; the docs say subagents get a fresh context each run, so the handoff problem for a Goal agent is solved by files, not by a summary prompt.
5. Handoff content: a handoff summary is lossy and ephemeral (OS temp dir, becomes a prompt); a Goal agent's durable handoff is the committed `state.md`. productivity/handoff deliberately keeps the file out of the workspace.

**No conflict** with the Engineering skills' issue and label conventions: neither skill writes issues or labels, and neither reads `docs/agents/`.

## 4. Adopt and avoid

Adopt
- The two-track thinking (tactical plus "how do I improve the environment for the next task"), recorded as issues, not done directly. Reason: fits the Goal agent's "files issues" limit and plugin-maintainer's objectives. Source: chief-of-staff SKILL.md "Strategic View".
- Context pointers over copied content; reference issues, commits and notes by path or URL. Source: both skills; same spirit as `state.md`'s "What next: issue numbers ... nothing else".
- The "no workarounds" rule as a Goal agent principle (a deviation from convention becomes an issue before feature work).
- A handoff-style fallback for a mid-session budget stop (a short note with suggested skills, redacted), but written into `state.md` or an issue comment, not temp. Source: handoff SKILL.md rules (suggested skills, no duplication, redaction).
- Optionally `claude --bg --name` for an unattended Goal agent session, knowing the local-only and idle-stop limits (section 2).

Avoid
- Relying on a single endless session or its context as the memory of the goal.
- The Goal agent doing the work itself through subagents; that removes the user's control and conflicts with issues being the unit of work (map #1 destination: "issues a Goal agent files are directly workable by the Engineering skills the user runs").
- Suggesting recurring schedules by default: nothing may depend on a session running soon (plugin-maintainer).
- Building on these skills' text as stable: they are in-progress. Copy ideas, not references.
- Using the temp-dir handoff as the system of record.

## 5. Implications for other tickets

- Whether a Goal agent may run unattended (`claude --bg`, schedules) is not covered by map #1 and could be its own question; the facts are in section 2.
- The `memory` frontmatter field (`.claude/agent-memory/<name>/`) is an alternative to `state.md` found in the official docs. Whether to prefer a committed `state.md` over agent memory is a design choice for the skeleton ticket (unverified which is better; `state.md` is committed and reviewable, agent memory is hidden and off when auto memory is off).
