# Goal agents with the Engineering skills

Recommendations for making a **Goal agent** and the **Engineering skills** work together: the issues a Goal agent files are directly workable by the Engineering skills the user runs, and both share one configuration that does not conflict (`docs/agents/`, labels, glossary).

Terms in bold are defined in [`GLOSSARY.md`](../GLOSSARY.md) and used as defined there.

## 1. Summary

| R | Recommendation |
|---|---|
| [R1](#r1) | Give every piece of Goal agent configuration and state exactly one home. |
| [R2](#r2) | File every issue through triage: `needs-triage`, one category label, the agent's scope label. |
| [R3](#r3) | Write the issue body as a four-section report, not as an Agent Brief. |
| [R4](#r4) | File flat issues only; mark a **Spec-sized** finding with one fixed sentence. |
| [R5](#r5) | One finding, one issue; never touch a spec's tree. |
| [R6](#r6) | Read `.out-of-scope/` before filing; re-raise a rejection only with new evidence. |
| [R7](#r7) | Answer `needs-info` questions at session start, as comments, without touching labels. |
| [R8](#r8) | Close an own issue only while it is still `needs-triage`; after triage, only comment. |
| [R9](#r9) | Open every agent-written issue body and comment with the AI marker. |
| [R10](#r10) | Use `goal-agent:<name>` as the agent's scope label, not as an origin label. |
| [R11](#r11) | Add a `Goal-agent: <name>` trailer to every agent commit. |
| [R12](#r12) | Rank the **Objectives** in the definition; each issue names its Objective. |
| [R13](#r13) | Keep the **Order** as blocking edges plus an ordered list the user owns. |
| [R14](#r14) | Use no priority, urgency or objective labels. |
| [R15](#r15) | Keep operational state in one **State issue** per Goal agent. |
| [R16](#r16) | Keep a **Deferred item** in the State issue until its trigger fires, then file it through triage. |
| [R17](#r17) | Write a handoff note only when stopping mid-flow, in the State issue, never in a scratchpad. |
| [R18](#r18) | Keep learnings in `memory: project`; require it and commit only that directory. |
| [R19](#r19) | Keep no session log and no copies of tracker facts. |
| [R20](#r20) | Read the shared configuration on the same triggers the Engineering skills use. |
| [R21](#r21) | Never write `docs/agents/*`, `GLOSSARY.md`, `docs/adr/` or `.out-of-scope/`. |
| [R22](#r22) | Put the **Goal agent contract** and the registry in a user-written `docs/agents/goal-agents.md`. |
| [R23](#r23) | Put tracker mechanics in a Goal agent operations section of `docs/agents/issue-tracker.md`. |
| [R24](#r24) | Add no `bug`/`enhancement` mapping to `triage-labels.md`. |
| [R25](#r25) | Keep the definition thin: only what is specific to this one agent. |
| [R26](#r26) | Set `memory: project` and `disallowedTools: Skill`; omit `skills:`. |
| [R27](#r27) | Gate every session on reading `goal-agents.md`, with CLAUDE.md as a second channel. |
| [R28](#r28) | Let the agent propose watch-list changes on its State issue; the user edits the definition. |
| [R29](#r29) | Require a **Goal review** for every PR that closes an issue labelled `goal-agent:<name>`. |
| [R30](#r30) | Run the Goal review locally, from the user's session, with the brief `Goal review of PR #<n>`. |
| [R31](#r31) | Start a Goal review like any session, then skip to the PR; the closing issues are its spec. |
| [R32](#r32) | Check the closing issues, drift from the Goal, and the agent's own review checks; not coding standards. |
| [R33](#r33) | Grade every finding blocking or non-blocking; any blocking finding blocks the PR. |
| [R34](#r34) | Post exactly one PR comment per reviewed head SHA, opening with the Goal review marker. |
| [R35](#r35) | Write only that comment, follow-up issues, the State issue and memory; never approve, push, merge or tag. |
| [R36](#r36) | Re-review only a new head SHA, and only when the user asks; no review-until-clean loop. |
| [R37](#r37) | Enforce the Goal review with a marker-checking commit status that branch protection requires. |

## 2. Scope and terms

**In scope.** How a Goal agent files, marks, orders and tracks issues so that the Engineering skills (`triage`, `to-spec`, `to-tickets`, `implement`, `implement-spec`, `tdd`, `code-review`, `wayfinder`) can work them, and which shared files each side reads or writes; and the **Goal review** of a pull request that closes a Goal agent's issue ([section 10](#10-goal-review)), with its enforcement in a consumer repo ([section 11](#11-goal-review-enforcement)). The pattern is general; it applies to any repo with the Engineering skills set up and one or more Goal agents.

**Out of scope** (from [map #1][1]): a Goal agent invoking Engineering skills itself (a Goal review is in scope, but the agent still invokes no skill, [R26](#r26)); Codex; changing the Engineering skills; running a Goal agent unattended (`claude --bg`, schedules); packaging the Goal agent contract as a preloaded skill (see [section 12](#12-trial-run)); applying these recommendations to a specific repo.

**Terms.** Goal agent, Engineering skills, Objective, Order, State issue, Checkpoint, Deferred item, Spec-sized, Goal agent contract and Goal review: see [`GLOSSARY.md`](../GLOSSARY.md). Triage terms (category label, state label, Agent Brief, reporter) are the `triage` skill's.

**Sources.** Each recommendation has a *Why:* and a *Source:* line. Decision tickets are linked by name. Skill paths are relative to `~/.claude/plugins/cache/mattpocock/mattpocock-skills/1.3.1/` (**mattpocock-skills 1.3.1**). Evidence from the `plugin-maintainer` Goal agent in [`hsmejky/ai-plugin-manager`](https://github.com/hsmejky/ai-plugin-manager) refers to commit `e191536`; it appears only as evidence, not as a worked example.

## 3. Where everything lives

<a id="r1"></a>
**R1. Give every piece of Goal agent configuration and state exactly one home, as in the table below.**

| Home | Holds | Written by | Read by |
|---|---|---|---|
| Definition `.claude/agents/<name>.md` | Frontmatter, read-first gate, Goal, ranked Objectives, Non-goals, watched sources with Checkpoint keys, agent-specific hard limits, session steps and Goal review checks ([R25](#r25)) | User | The Goal agent |
| `docs/agents/goal-agents.md` § Goal agent contract | Session lifecycle, Goal review session, report template, labels the agent applies, AI marker, never-write list, memory commit rule, State issue structure, commit trailer ([Appendix B](#appendix-b-draft-docsagentsgoal-agentsmd)) | User | Every Goal agent |
| `docs/agents/goal-agents.md` § Goal agents in this repo | Registry: each Goal agent, its `goal-agent:<name>` label, its definition; the `goal-agent:state` label | User | Every Goal agent |
| `docs/agents/issue-tracker.md` § Goal agent operations | Tracker commands: find, create and update the State issue, create a registered label; "not triage work" rule ([Appendix C](#appendix-c-docsagentsissue-trackermd--goal-agent-operations)) | User | Every Goal agent |
| State issue (label `goal-agent:state`) | Order, Deferred items, Checkpoints, pending handoff note ([R15](#r15)) | Goal agent and user | Goal agent and user |
| `.claude/agent-memory/<name>/` (`memory: project`) | Learnings about how the agent does its own job ([R18](#r18)) | Goal agent | Goal agent |
| Tracker (issues, labels, blocking edges) | Everything else: findings, triage state, dependencies | Goal agent, user, Engineering skills | Everyone |
| PR comment opening with the Goal review marker | One Goal review: verdict and findings for one head SHA ([R34](#r34)) | Goal agent | User, the `goal-agent-review` workflow |
| `.github/workflows/goal-agent-review.yml` in a consumer repo | Marker check that sets the `goal-agent-review` commit status ([R37](#r37)) | User | GitHub Actions, branch protection |

*Why:* copies drift. In `plugin-maintainer`, the definition restated its own issue shape and P1–P4 labels, and both drifted away from what the skills read; its committed `state.md` copied tracker facts and was stale within a day. One home per item also means the user can change a shared convention in one place for every Goal agent.
*Source:* [Which shared configuration may a Goal agent read, extend, or own?][8], as amended by [Is the shared Goal agent contract a doc, a preloaded skill, or both?][12] and [What does a generic Goal agent definition look like?][13]; [Where does a Goal agent keep its state?][7]; [How have plugin-maintainer's issues fared with the Engineering skills?][3].

## 4. Filing issues

<a id="r2"></a>
**R2. File every issue through triage: `needs-triage`, exactly one category label, and the agent's `goal-agent:<name>` label.**

- `needs-triage` is the only state label the agent ever applies. Triage writes the Agent Brief and moves the issue to `ready-for-agent`, `ready-for-human`, `needs-info` or `wontfix`.
- The category is `bug` or `enhancement`, the agent's best guess; triage may change it. Every finding that is not a defect (glossary entry, ADR, research) is `enhancement`.
- Never `ready-for-agent`, never a `wayfinder:*` label.

*Why:* triage is the only Engineering skill with a strict issue contract (one category, one state label, an Agent Brief comment); `implement`, `tdd` and `code-review` read no labels, so triage is the one gate where the user endorses the work. `plugin-maintainer`'s issues were workable (38/38 closed) but bypassed that gate: all carried `ready-for-agent`, none had a category label or a brief. Triage knows only the two literal categories, so non-defects need a fixed default.
*Source:* [Should a Goal agent's issues enter through triage or arrive ready-for-agent?][5], as amended by [What does a generic Goal agent definition look like?][13] (category default); [What do the Engineering skills expect from an issue and from docs/agents?][2]; [How have plugin-maintainer's issues fared with the Engineering skills?][3]; `skills/engineering/triage/SKILL.md` § Roles.

<a id="r3"></a>
**R3. Write the issue body as a four-section report (`## Observation`, `## Evidence`, `## Why it matters`, `## Suggested outcome`), not as an Agent Brief.**

- Evidence holds links, paths, quotes, command output and source versions; `file:line` is allowed.
- Why it matters names the Objective ([R12](#r12)) and states any urgency ([R14](#r14)).
- Suggested outcome is a proposal for triage: no acceptance criteria, no Agent Brief.

The template is in [Appendix B](#appendix-b-draft-docsagentsgoal-agentsmd).

*Why:* the Agent Brief is triage's output and "the contract"; a report gives triage what it needs without pre-empting it. Paths are fine in a report because the brief, which bans them as stale-prone, is written later. `plugin-maintainer` used its own Gap/Evidence/Done-when shape, so no issue had a brief or an out-of-scope section.
*Source:* [Should a Goal agent's issues enter through triage or arrive ready-for-agent?][5]; `skills/engineering/triage/AGENT-BRIEF.md`; [How have plugin-maintainer's issues fared with the Engineering skills?][3].

<a id="r4"></a>
**R4. File flat issues only; when a finding is Spec-sized, end Suggested outcome with the fixed sentence `Spec-sized: needs a spec and slices before implementation.`**

- The threshold is `to-tickets`'s own sizing rule: it won't fit one fresh context window, or isn't verifiable on its own. The agent judges when filing; triage decides. When unsure, omit the sentence.
- No Spec-sized label, no `Spec:` title prefix.
- The user runs `to-spec` with the flat issue as context, labels the spec `goal-agent:<name>`, runs `to-tickets`, then closes the flat issue with `Superseded by <spec>`. The spec takes the flat issue's slot in the Order ([R13](#r13)). Slices are not labelled: `to-tickets` applies only `ready-for-agent`, so they stay out of the agent's scope.

*Why:* slicing is design work and belongs to the user's session. In `ai-plugin-manager`, only the spec path (#71 with slices #64–#70, PR #72) showed the Engineering shape end to end, and it started from a flat issue (#60: "There is no spec, so no slice can be run"). `implement-spec` reads no labels, so slices the agent filed would run untriaged.
*Source:* [Should a Goal agent file flat issues or a spec with sliced tickets?][10]; `skills/engineering/to-tickets/SKILL.md:33`; `skills/engineering/implement-spec/SKILL.md`; [ai-plugin-manager#60](https://github.com/hsmejky/ai-plugin-manager/issues/60), [#71](https://github.com/hsmejky/ai-plugin-manager/issues/71).

<a id="r5"></a>
**R5. One finding, one issue; never split a finding, and never touch a spec's tree.**

- Separate issues only for findings that are independently worth closing, each serving its own Objective. Never split a finding to get under the Spec-sized threshold.
- No sub-issue links or blocking edges on a spec or its slices. A finding that touches an in-flight spec is a flat issue naming the spec in Evidence.
- Blocking edges only between the agent's own flat issues.

*Why:* splitting hides a design problem behind several small issues; `to-tickets` owns the spec's tree ("Do NOT close or modify any parent issue"). `plugin-maintainer` used umbrella issues and prose blockers instead of slices and native edges.
*Source:* [Should a Goal agent file flat issues or a spec with sliced tickets?][10]; `skills/engineering/to-tickets/SKILL.md`; [How have plugin-maintainer's issues fared with the Engineering skills?][3].

<a id="r6"></a>
**R6. Read `.out-of-scope/` before filing in an area; never file a match of a past rejection unless there is new evidence, and then link the rejection entry and state what changed.**

*Why:* `.out-of-scope/` is triage's record of rejected enhancements, and triage checks every request against it; re-filing a rejection without new evidence wastes a triage pass.
*Source:* [Should a Goal agent's issues enter through triage or arrive ready-for-agent?][5]; [Which shared configuration may a Goal agent read, extend, or own?][8]; `skills/engineering/triage/SKILL.md:70`, `skills/engineering/triage/OUT-OF-SCOPE.md`.

<a id="r7"></a>
**R7. At session start, answer open `needs-info` questions on issues the agent filed, as marked comments, without touching labels.**

*Why:* triage's third queue is "`needs-info` with reporter activity since the last triage notes"; the agent is the reporter, so a marked reply ([R9](#r9)) puts the issue back in front of triage without the agent changing triage's state.
*Source:* [Should a Goal agent's issues enter through triage or arrive ready-for-agent?][5]; [How are a Goal agent's issues marked as agent-authored?][9]; `skills/engineering/triage/SKILL.md:62`.

<a id="r8"></a>
**R8. Close an own issue only while it is still `needs-triage`, with a marked comment saying why; after triage, only comment. Marked comments are allowed on any issue.**

*Why:* the triage transition is the user's endorsement; closing a triaged issue would override a user decision. Before triage, a finding that disappeared (for example, fixed upstream) is still the agent's own.
*Source:* [What does a generic Goal agent definition look like?][13]; [How are a Goal agent's issues marked as agent-authored?][9].

## 5. Marking agent output

<a id="r9"></a>
**R9. Open every issue body and every comment the agent writes with `> *This was generated by AI: <name> Goal agent.*`**

- Same tracker account as the user; a bot account or GitHub App per agent is an optional upgrade, not required.
- The marker means origin, not endorsement. It stays when the user edits the issue; endorsement is the triage transition. The agent never edits text it did not write.
- The State issue body carries no marker (it is co-edited and identified by its label and title); the agent's comments on it do.
- A Goal review comment puts the hidden Goal review marker on its first line and this AI marker on the next, so the AI marker is still the first visible line ([R34](#r34)).

*Why:* in `plugin-maintainer`, authorship was unrecoverable: one account, no disclaimer anywhere. The shared prefix with triage's `> *This was generated by AI during triage.*` finds all AI output with one search, and the different ending lets triage tell a reporter reply from its own notes. Naming the agent tells several Goal agents in one repo apart. A separate identity would cost a second account, token handling and `gh` under different auth.
*Source:* [How are a Goal agent's issues marked as agent-authored?][9]; `skills/engineering/triage/SKILL.md:13-16`; [How have plugin-maintainer's issues fared with the Engineering skills?][3].

<a id="r10"></a>
**R10. Use `goal-agent:<name>` as the agent's scope label: the agent puts it on every issue it files, the user puts it on their own issues in the agent's scope, and the agent creates it only once it is listed in `goal-agents.md`.**

*Why:* the Order covers every open issue in the agent's scope, user-filed ones included ([R13](#r13)); a label makes that scope deterministic and cheap to query, and the AI marker already shows origin. No Engineering skill reads the label, so it cannot disturb them. `state` is reserved (`goal-agent:state`).
*Source:* [How are a Goal agent's issues marked as agent-authored?][9], as amended by [What does a generic Goal agent definition look like?][13]; [Which shared configuration may a Goal agent read, extend, or own?][8] (label creation rule).

<a id="r11"></a>
**R11. End every commit the agent makes with a `Goal-agent: <name>` trailer.**

*Why:* the agent's only commits are its memory ([R18](#r18)); the trailer makes them findable in `git log` without a separate account, the commit counterpart of the AI marker.
*Source:* [How are a Goal agent's issues marked as agent-authored?][9].

## 6. Order and priority

<a id="r12"></a>
**R12. List the Objectives in rank order in the definition; every issue serves exactly one Objective and names it in Why it matters.**

*Why:* "priority" in `plugin-maintainer` mixed category, urgency and order. Objective rank is the stable part and the default rule for deriving the Order; naming it in the body needs no label.
*Source:* [Where does a Goal agent's priority axis live?][6]; `ai-plugin-manager: .claude/agents/plugin-maintainer.md:26`.

<a id="r13"></a>
**R13. Keep the Order as native blocking edges where a real dependency exists, and otherwise as an ordered list in the State issue's `## Order`; the Order is a recommendation the user owns.**

- It covers every open issue labelled `goal-agent:<name>`, user-filed included (placed by the user's stated priority, else by Objective rank). A spec that superseded one of them carries the label too ([R4](#r4)) and takes its slot (substitution, not reordering); slices never enter the Order; the spec leaves when it closes.
- The agent re-reads the body right before every write, prunes closed issues, and inserts new ones where it recommends. When a pruned issue was closed `Superseded by <spec>`, the agent puts the spec in its slot; this is the substitution, so the slot survives even if the user has not edited the Order yet. It never moves an existing entry and never reverts the user's reordering. A suggested reorder goes in a marked comment on the State issue.
- The user reorders in the GitHub UI, without a commit.

*Why:* native blocking edges are the only ordering the Engineering skills read (the `wayfinder` and `implement-spec` frontier). An ordered list in a user-editable issue keeps the user in charge of what runs next. `plugin-maintainer`'s `state.md` "What next" already held an explicit order, but in a file that went stale.
*Source:* [Where does a Goal agent's priority axis live?][6]; [Where does a Goal agent keep its state?][7]; [Should a Goal agent file flat issues or a spec with sliced tickets?][10]; [What does a generic Goal agent definition look like?][13] (scope by label); `skills/engineering/wayfinder/SKILL.md`, `skills/engineering/to-tickets/SKILL.md`.

<a id="r14"></a>
**R14. Use no priority, urgency or objective labels; state urgency in Why it matters and express it as an earlier position in the Order.**

*Why:* no Engineering skill reads priority. `plugin-maintainer`'s P1–P4 drifted from category to rank (18 of 38 issues P4, #53 P2 against its own table) and was dropped from #64–#70.
*Source:* [Where does a Goal agent's priority axis live?][6]; [How have plugin-maintainer's issues fared with the Engineering skills?][3]; `ai-plugin-manager: docs/agents/triage-labels.md` (Priority labels section).

## 7. State

<a id="r15"></a>
**R15. Keep operational state in one State issue per Goal agent, labelled `goal-agent:state`, with the agent's name in its title and the body sections `## Order`, `## Deferred items`, `## Checkpoints`, and `## Handoff` only while a note is pending.**

- The agent creates it on its first session if missing. If more than one matches, it stops and asks.
- `## Checkpoints` has one entry per watched source, keyed as in the definition ([R25](#r25)).
- The State issue is not triage work ([R23](#r23)); the agent's findings, which carry `goal-agent:<name>`, are.

*Why:* the readers of state are the agent and the user (no Engineering skill reads it), so every part the user acts on must be easy to read and edit; an issue renders linked issues with title and state and needs no commit. A non-triage label keeps it out of triage's "Unlabeled" bucket. Several Goal agents can share the label because each title names its agent. Rejected: a committed `state.md` for everything (`plugin-maintainer`'s went stale within a day and took 18 direct commits in one day) and GitHub Projects (setup, token scope, outside the issue list).
*Source:* [Where does a Goal agent keep its state?][7]; [Which shared configuration may a Goal agent read, extend, or own?][8]; [How have plugin-maintainer's issues fared with the Engineering skills?][3]; `ai-plugin-manager: state.md`.

<a id="r16"></a>
**R16. Keep a Deferred item, with its trigger, in the State issue's `## Deferred items`; the first session after the trigger fires files it through triage and removes the entry.**

*Why:* no triage role means "waiting on an external event", so a Deferred item filed early would sit in the queue with nothing to decide.
*Source:* [Where does a Goal agent keep its state?][7].

<a id="r17"></a>
**R17. Write a handoff note only when a session stops mid-flow, in the State issue's `## Handoff`, never in a scratchpad file; the next session reads it, acts on it and deletes it.**

*Why:* the next session may start on another day or machine, which a temporary scratchpad does not survive. The contract states this override explicitly because a user's global instructions (loaded into subagents through CLAUDE.md) may prescribe a scratchpad handoff. The read-and-delete rule comes from chief-of-staff.
*Source:* [Where does a Goal agent keep its state?][7], as amended by [What does a generic Goal agent definition look like?][13]; [What do chief-of-staff and claude-handoff do, and how do they overlap with a Goal agent?][4].

<a id="r18"></a>
**R18. Keep learnings in `memory: project` (`.claude/agent-memory/<name>/`); treat it as required, and commit only that directory, alone, directly to `main`, at most once per session and only when it changed, with the `Goal-agent:` trailer.**

- Memory holds only how the agent does its own job (where a source lives, a quirk of a tool). A learning that is a domain term or a decision becomes an issue ([R21](#r21)).
- At session start, a read-only check: if `CLAUDE_CODE_DISABLE_AUTO_MEMORY` is `1`, or it is not `0` and `autoMemoryEnabled` is false in a settings file, the session reports that memory is off and stops instead of running without it. `0` forces auto memory on, even over `autoMemoryEnabled: false`, so only `1` disables it through the variable.

*Why:* the first 200 lines of `MEMORY.md` are auto-loaded into every session, unlike issue comments (unbounded and never auto-loaded). With auto memory disabled the field has no effect, and a session would silently lose its learnings. One narrow commit right keeps the agent out of code, docs and configuration.
*Source:* [Where does a Goal agent keep its state?][7], as amended by [Which shared configuration may a Goal agent read, extend, or own?][8] (no domain terms in memory) and [What does a generic Goal agent definition look like?][13] (rule in the contract, detection method); [Claude Code environment variables docs](https://code.claude.com/docs/en/env-vars) (`1` disables, `0` forces on); [How are a Goal agent's issues marked as agent-authored?][9] (trailer); [Claude Code sub-agents docs](https://code.claude.com/docs/en/sub-agents).

<a id="r19"></a>
**R19. Keep no session log and no copies of tracker facts; query open issues, labels, blocking edges and `needs-info` fresh every session.**

*Why:* what a session did is already in the tracker and `git log`. `plugin-maintainer`'s `state.md` "What next" listed four closed issues and missed #64–#71 and PR #72 within one day.
*Source:* [Where does a Goal agent keep its state?][7]; [How have plugin-maintainer's issues fared with the Engineering skills?][3].

## 8. Shared configuration

<a id="r20"></a>
**R20. Read the shared configuration on the same triggers the Engineering skills use: `goal-agents.md`, `issue-tracker.md`, `triage-labels.md` and `GLOSSARY.md` every session; the relevant ADRs and `.out-of-scope/` before filing in an area.**

*Why:* the agent files issues every session, so it needs the tracker commands, label strings and glossary terms; ADRs and rejections matter only for the area at hand. `docs/agents/domain.md` says where the glossary and ADRs live.
*Source:* [Which shared configuration may a Goal agent read, extend, or own?][8]; [Is the shared Goal agent contract a doc, a preloaded skill, or both?][12]; `docs/agents/domain.md`.

<a id="r21"></a>
**R21. Never write `docs/agents/*`, `GLOSSARY.md`, `docs/adr/` or `.out-of-scope/`; a term or decision the agent wants recorded goes through triage as an ordinary `enhancement` issue ("add glossary entry X", "record ADR Y").**

*Why:* every Engineering skill treats these files as authoritative, so an agent write would silently change how the other skills behave. Today only `setup-matt-pocock-skills` writes `docs/agents/`, `domain-modeling` and `improve-codebase-architecture` write the glossary and ADRs, and only `triage` writes `.out-of-scope/`. This extends `plugin-maintainer`'s existing rule "Write only `state.md` and issues".
*Source:* [Which shared configuration may a Goal agent read, extend, or own?][8]; [Should a Goal agent's issues enter through triage or arrive ready-for-agent?][5]; `ai-plugin-manager: .claude/agents/plugin-maintainer.md:60`.

<a id="r22"></a>
**R22. Put the Goal agent contract and the per-repo registry in one user-written document, `docs/agents/goal-agents.md`, with two sections (`## Goal agent contract`, `## Goal agents in this repo`), linked from the `## Agent skills` block in CLAUDE.md. It is a doc, not a preloaded skill.**

*Why:* one file to read and one link from CLAUDE.md; a separate contract file would be one more thing to keep in sync across repos. The user writes it because `docs/agents/` is user-owned configuration ([R21](#r21)); [Appendix B](#appendix-b-draft-docsagentsgoal-agentsmd) is a starting point. Preloading through `skills:` is harness-guaranteed, unlike a read instruction, but the trial run showed the doc is enough ([section 12](#12-trial-run)).
*Source:* [Is the shared Goal agent contract a doc, a preloaded skill, or both?][12]; [What does a subagent's skills: frontmatter load, and when?][11]; [Which shared configuration may a Goal agent read, extend, or own?][8].

<a id="r23"></a>
**R23. Put tracker mechanics in a `## Goal agent operations` section of `docs/agents/issue-tracker.md`, beside Wayfinding operations: the State label and how to find, create and update the State issue, label creation, and the rule that the State issue (`goal-agent:state`) is not triage work.**

- The agent may run `gh label create` only for a label named in `docs/agents/` that is missing on the tracker; it never invents one.

*Why:* commands are tracker-specific and the contract is not; keeping them apart lets a GitLab repo swap only this section. No skill reliably creates labels (`setup-matt-pocock-skills` is meant to, but the plugin records it as known bug #616, and nothing creates `wayfinder:*`), so without the creation rule a first session would fail on a missing label. Triage's first bucket is "Unlabeled", so a State issue needs the explicit exclusion. It names `goal-agent:state` only: a wildcard `goal-agent:*` would also match the scope label every finding carries and take the findings out of triage ([R2](#r2)).
*Source:* [Which shared configuration may a Goal agent read, extend, or own?][8]; [Is the shared Goal agent contract a doc, a preloaded skill, or both?][12]; `docs/engineering/triage.md:78`; `skills/engineering/triage/SKILL.md:60`.

<a id="r24"></a>
**R24. Add no `bug`/`enhancement` mapping to `docs/agents/triage-labels.md`; add one, in that shared file, only in a repo that renames them.**

*Why:* `triage` uses those literal names, `setup-matt-pocock-skills` never asks about them, and GitHub creates both in every new repo.
*Source:* [Which shared configuration may a Goal agent read, extend, or own?][8]; `skills/engineering/triage/SKILL.md:26-30`.

## 9. The Goal agent definition

<a id="r25"></a>
**R25. Keep the definition thin: frontmatter, the read-first gate, Goal, ranked Objectives, Non-goals, watched sources each with a Checkpoint key, agent-specific hard limits, agent-specific session steps (work loop, "done" rule, extra start and end steps), and agent-specific Goal review checks ([R32](#r32)). Everything generic lives in the Goal agent contract.**

*Why:* sections 3–8 put every shared rule in `goal-agents.md` or `issue-tracker.md`; a definition that restated them would drift, as `plugin-maintainer`'s brief shape and P1–P4 labels did. The generic session lifecycle (start, filing, end) is the same for every Goal agent, so it is in the contract and the definition only fills in its hooks. [Appendix A](#appendix-a-definition-skeleton) is the skeleton.
*Source:* [What does a generic Goal agent definition look like?][13]; [Which shared configuration may a Goal agent read, extend, or own?][8], as amended by [Is the shared Goal agent contract a doc, a preloaded skill, or both?][12] and [What does a generic Goal agent definition look like?][13] (session lifecycle in the contract).

<a id="r26"></a>
**R26. In the frontmatter, set `memory: project` and `disallowedTools: Skill`, and omit `skills:`; enforce the file boundary in prose.**

*Why:* `memory: project` holds learnings ([R18](#r18)). Unlisted skills stay invocable through the Skill tool, so `disallowedTools: Skill` is the one-line way to stop the agent from running `/triage`, `/to-tickets` or other Engineering skills itself, which is out of scope. `skills:` stays empty because the contract is not preloaded ([R22](#r22)). The trial run showed no stray write, so the file boundary has no hook ([section 12](#12-trial-run)).
*Source:* [What does a generic Goal agent definition look like?][13]; [What does a subagent's skills: frontmatter load, and when?][11]; [Where does a Goal agent keep its state?][7].

<a id="r27"></a>
**R27. Open the definition with a hard gate, "Read `docs/agents/goal-agents.md` first, every session; if you cannot, stop", and link `goal-agents.md` from CLAUDE.md's `## Agent skills` block as a second channel.**

*Why:* a pointer-only definition rests on a read instruction, which the harness does not guarantee; an agent that skipped it would file unmarked, unlabelled issues and recreate `plugin-maintainer`'s failures. CLAUDE.md loads into custom subagents by default, so the link reaches the agent even if it skips the instruction.
*Source:* [What does a generic Goal agent definition look like?][13]; [What does a subagent's skills: frontmatter load, and when?][11]; [Is the shared Goal agent contract a doc, a preloaded skill, or both?][12].

<a id="r28"></a>
**R28. Let the agent propose adding or dropping a watched source in a marked comment on its State issue; the user edits the definition.**

*Why:* the watch list is in the definition, which the agent never writes. A watch-list change is about the agent itself, not project work, so the triage queue is the wrong place for it.
*Source:* [What does a generic Goal agent definition look like?][13]; [Where does a Goal agent keep its state?][7].

## 10. Goal review

The user implements a Goal agent's issues in their own sessions with the Engineering skills (`implement`, `code-review`, `pr`) and opens a PR. Before merging, the Goal agent checks the PR against the issues it closes and against its Goal: a Goal review. `code-review` already checks the diff on two axes, coding standards and the originating spec; a Goal review leaves standards to it and judges the PR from the Goal agent's side: the issues it owns and its Goal.

Evidence for every rule in this section: in `ai-plugin-manager`, the user asked the main session by hand to spawn `plugin-maintainer` on PRs [#37][16], [#48][17], [#52][18], [#56][19], [#72][20], [#79][21] and [#100][22] (session transcripts). Every call improvised its prompt, write permissions changed from call to call (PR comment, follow-up issues and a state push in one; "report-only" in another, after which the user asked why state was not updated), the user had to ask whether the review had happened yet, re-review after fixes was requested each time, and the user, never the agent, merged and tagged.

<a id="r29"></a>
**R29. Require a Goal review for every PR whose closing references include an issue labelled `goal-agent:<name>`; that label names the reviewing agent.**

- Closing references are the tracker's own (`gh pr view <n> --json closingIssuesReferences`: `Closes`, `Fixes`, `Resolves`). A PR that only says `Part of #N` or `Refs #N` is not gated; this is an accepted limitation.
- A PR closing issues of several Goal agents needs one Goal review from each.
- Every other PR needs none.

*Why:* the scope label already says which agent owns an issue ([R10](#r10)), so the gate needs no new configuration; closing references are what the tracker exposes to a workflow ([R37](#r37)), unlike prose mentions. A Goal agent has nothing to say about a PR outside its scope.
*Source:* Goal review design, approved by the user on 2026-10-15 ([ADR 0001][15]); `ai-plugin-manager` PR reviews above.

<a id="r30"></a>
**R30. Run the Goal review locally: the user's session spawns the Goal agent with the brief `Goal review of PR #<n>` and nothing else. A consumer repo may add a project skill `/goal-review <PR>` that builds this brief.**

- The PR number is the only input; everything else the agent reads itself ([R31](#r31)).
- The agent keeps `disallowedTools: Skill` ([R26](#r26)); the `/goal-review` skill runs in the user's session, never in the agent.
- Not in GitHub Actions: running an agent in CI is unattended, which is out of scope ([section 2](#2-scope-and-terms)), and the review runs on the user's subscription.

*Why:* in `ai-plugin-manager` every review call improvised its prompt and with it the agent's write permissions. A fixed one-line brief moves everything else into the contract, where it is the same every time.
*Source:* Goal review design, approved by the user on 2026-10-15 ([ADR 0001][15]); `ai-plugin-manager` PR reviews above.

<a id="r31"></a>
**R31. Start a Goal review like any session, through finding the State issue, then go straight to the PR; the closing issues, with their comments, are the review's spec.**

- Run the contract's start steps 1–3 (read the shared configuration, check memory, find the State issue). Skip the rest: a pending `## Handoff`, `needs-info` answers and Deferred items wait for the next regular session, and there is no work loop and no sweep over the Objectives.
- Read the PR (`gh pr view`, `gh pr diff`), its head SHA (`headRefOid`), and each closing issue with all its comments. A later comment overrides an earlier one; an Agent Brief comment is the spec.

*Why:* the review needs the contract and memory as much as any session, but acting on a handoff or sweeping sources would turn one review into a full session the user did not ask for. Triage's Agent Brief is the contract the implementer worked to ([R3](#r3)), so it is the yardstick.
*Source:* Goal review design, approved by the user on 2026-10-15.

<a id="r32"></a>
**R32. Check three things, and not coding standards: (a) each closing issue's request and "done when" criteria are met; (b) no drift from the Goal: the changes serve the Goal and its Objectives, stay within the closing issues' scope, and touch no Non-goal; (c) the agent-specific checks in the definition's `## Goal review` section.**

*Why:* (a) overlaps `code-review`'s Spec axis on purpose: the agent filed or owns the issue, so it reads the request as its reporter, with the issue's history. (b) needs the Goal, Objectives and Non-goals, which `code-review` never sees. Coding standards are `code-review`'s Standards axis; checking them twice would only produce conflicting findings. (c) keeps checks that only one agent needs out of the contract ([R25](#r25)).
*Source:* Goal review design, approved by the user on 2026-10-15; `skills/engineering/code-review/SKILL.md` (Standards and Spec axes).

<a id="r33"></a>
**R33. Grade every finding: blocking when a closing issue's requirement or "done when" criterion is not met, when the PR drifts from the Goal or touches a Non-goal, or when it breaks an Objective; non-blocking otherwise. The verdict is `blocked` if and only if there is at least one blocking finding, else `pass`.**

*Why:* a fixed, short list of blocking grounds keeps the verdict predictable for the user and for the workflow that enforces it ([R37](#r37)); everything else is advice the user may take or leave.
*Source:* Goal review design, approved by the user on 2026-10-15.

<a id="r34"></a>
**R34. Post exactly one PR comment per reviewed head SHA (`gh pr comment`). Its first line is the Goal review marker, its second the AI marker ([R9](#r9)); then the verdict, the blocking findings, the non-blocking findings (with `file:line`), and the follow-up issues filed.**

```markdown
<!-- goal-agent-review:<name> sha=<40-hex head SHA> verdict=pass|blocked -->
> *This was generated by AI: <name> Goal agent.*

**Verdict: pass | blocked**

### Blocking
- <finding>, `path/to/file:line`. <Which issue requirement, Objective or Non-goal.>

### Non-blocking
- <finding>, `path/to/file:line`.

### Follow-ups filed
- #<n> <title>
```

*Why:* the marker is machine-readable, so a workflow can verify that a review exists for exactly the commit being merged ([R37](#r37)); as an HTML comment it does not render, so readers see the AI marker first. The full 40-character SHA avoids prefix ambiguity. One comment per SHA keeps the PR timeline readable and the latest verdict unambiguous.
*Source:* Goal review design, approved by the user on 2026-10-15 ([ADR 0001][15]).

<a id="r35"></a>
**R35. During a Goal review, write only: the one PR comment, follow-up `needs-triage` issues for findings outside the PR's scope (filed and deduplicated by the normal filing rules, [R2](#r2)–[R6](#r6)), the State issue (`## Order` for the follow-ups), and memory ([R18](#r18)). Never approve, request changes, push to the PR branch, merge, or create tags or releases. End with a report to the caller: the verdict and findings, at most 300 words.**

*Why:* in `ai-plugin-manager` the permissions changed per call, and a "report-only" review left state stale. A fixed write set makes every review behave the same. Approving, merging and tagging are the user's decisions; a push to the PR branch would make the agent an implementer and change the head SHA it just reviewed.
*Source:* Goal review design, approved by the user on 2026-10-15; `ai-plugin-manager` PR reviews above.

<a id="r36"></a>
**R36. Re-review only when the PR has a new head SHA (after fixes) and the user asks; if a Goal review comment for the current head SHA already exists, report its verdict instead of reviewing again. Never loop review and fix until clean.**

*Why:* a new commit invalidates the old verdict, and the workflow sets the status back to pending ([R37](#r37)), so the user knows when a re-review is due. A review-until-clean loop would put the agent in charge of when the PR is done, which is the user's call.
*Source:* Goal review design, approved by the user on 2026-10-15; `ai-plugin-manager` PR reviews above.

## 11. Goal review enforcement

A consumer repo adopts this section to make a forgotten Goal review block the merge. It is described here, not shipped: each repo writes its own workflow. The agent never writes the workflow or the branch protection.

<a id="r37"></a>
**R37. Enforce the Goal review with a workflow that checks for the marker comment and sets the commit status `goal-agent-review` on the PR's head SHA, required by branch protection on `main` with enforcement for admins.**

The workflow, `.github/workflows/goal-agent-review.yml`:

- **Triggers:** `pull_request` (`opened`, `synchronize`, `reopened`, `edited`) and `issue_comment` (`created`, `edited`, only when the issue is a PR). `edited` catches a changed closing reference in the PR body; `synchronize` catches a new head SHA.
- **Permissions:** `contents: read`, `pull-requests: read`, `issues: read`, `statuses: write`. Concurrency: one run per PR, the newest wins.
- **Logic:**
  1. Query `closingIssuesReferences { number labels { name } }` (GraphQL) and collect the agent names from `goal-agent:<name>` labels.
  2. None: status `success`, "No goal-agent issue closed".
  3. Otherwise, for each agent, take the latest PR comment whose `author_association` is `OWNER`, `MEMBER` or `COLLABORATOR` and whose body starts with `<!-- goal-agent-review:<name> sha=<current head SHA>`.
  4. Every agent `pass`: `success`. Any `blocked`: `failure`. Any missing: `pending`, "Run /goal-review <n>".
- **Report:** a commit status with context `goal-agent-review` on the head SHA, not a check run: a run triggered by `issue_comment` cannot attach a check run to the PR head.
- **Branch protection** on `main`: required status contexts `goal-agent-review` plus the repo's own tests, and enforce for admins, otherwise `gh pr merge --admin` bypasses it. The user sets it up, after the workflow works.

Limits the adopting repo accepts:

- `issue_comment` workflows run from the default branch, so the gate works only once the workflow is merged to `main`.
- The status proves that a review was posted for this SHA by someone with write access, not that it was sound. The Goal agent posts under the user's account ([R9](#r9)), so its comments pass the author check; a marker from anyone else is ignored.
- PRs that only say `Part of #N` or `Refs #N` are not gated ([R29](#r29)).

*Why:* without enforcement the review is forgotten; in `ai-plugin-manager` the user had to ask whether it had happened. Running the agent itself in CI was rejected ([R30](#r30)); checking a marker is cheap, needs no model and no secret, and ties the verdict to the exact commit being merged.
*Source:* Goal review design, approved by the user on 2026-10-15 ([ADR 0001][15]); [GitHub docs: commit statuses](https://docs.github.com/en/rest/commits/statuses), [protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

## 12. Trial run

These recommendations were complete without a trial; three points were deferred until a trial run showed whether they are needed. One full `plugin-maintainer` session in `ai-plugin-manager` ran on 2026-10-14 with Claude Code 2.1.300, plus short runs for the memory check ([trial results][14]). It settled the first two points and half of the third. One session is a small sample, so each fallback stays recorded for a later session that shows the problem. One research recommendation still has no decision. The Goal review ([sections 10](#10-goal-review) and [11](#11-goal-review-enforcement)) was designed after the trial and has not been trialled.

| Point | Decision after the trial | Trial evidence | Still open | If a later session shows a problem |
|---|---|---|---|---|
| Preloading the contract | Doc plus read gate, no preload ([R22](#r22), [R27](#r27)) | The one new issue carried the marker, the `needs-triage` and `goal-agent:<name>` labels, the four-section report template and an Objective in `## Why it matters`; no `ready-for-agent`. The session posted no comments. | Comments: none were posted, so their marker is untested. | Package the contract as a skill preloaded through `skills:`, cut along the section boundary (contract becomes the skill, registry stays in the doc). Mind that the skill then stays model-invocable in the main session unless restricted, an unresolved name is skipped silently, and `disable-model-invocation: true` blocks preloading ([What does a subagent's skills: frontmatter load, and when?][11]). |
| Commit hook | `disallowedTools: Skill` plus prose, no hook ([R26](#r26)) | One commit, touching only `.claude/agent-memory/<name>/`, with the `Goal-agent:` trailer. Every `Write` call targeted that directory; `Bash` wrote only temporary files. No Skill tool call. The State issue's `## Order` changed only by insertion. | None. | Add a PreToolUse hook that rejects `git add`/`git commit` paths outside the memory directory. |
| Memory sentinel | Read-only check of `CLAUDE_CODE_DISABLE_AUTO_MEMORY` and `autoMemoryEnabled` ([R18](#r18)), reworded so that only `1` disables memory through the variable | With `1` in the session's environment, the session reported memory off and stopped; with `0`, it continued. The variable must be set in the shell that launches Claude Code: set elsewhere, it never reached the session, which continued. The first wording ("is set") would have stopped on `0`, which forces memory on. | Whether learnings survive to the next session: one session cannot show it. | Add a first-run sentinel line in memory; later sessions stop if it is not in the auto-loaded context. |
| Two-track thinking and the no-workarounds rule | None. [What do chief-of-staff and claude-handoff do, and how do they overlap with a Goal agent?][4] recommended adopting chief-of-staff's two-track thinking (tactical work plus "improve the environment for the next task", recorded as issues) and its no-workarounds rule, but no decision ticket placed them in the contract. | Not checked by the trial. | Whether sessions miss environment improvements or work around conventions instead of filing them. | Decide whether they belong in the Goal agent contract, then add them to `goal-agents.md`. |

## Appendix A: Definition skeleton

A starting point for `.claude/agents/<name>.md`. Angle brackets are placeholders; `tools` and `model` are per agent.

```markdown
---
name: <name>
description: >
  Goal agent that owns <long-term goal>. Finds <kinds of findings> in <watched
  sources> and files each one through triage; the user runs the issues.
  Use only when the user asks for a <name> session or a Goal review of a PR.
tools: Read, Grep, Glob, Bash, WebFetch, WebSearch
disallowedTools: Skill
model: <model>
memory: project
---

You are the <name> Goal agent. You work across many short sessions; continuity
lives in your State issue, the tracker and your memory, never in conversation.

**Read `docs/agents/goal-agents.md` first, every session, and follow its
Goal agent contract. If you cannot read it, stop and say so.**

## Goal

<One paragraph: the state of the world this agent keeps true.>

## Objectives (ranked; rank is the default rule for the Order)

1. **<Objective 1>.** <What must stay true.> Sources: <source A>.
2. **<Objective 2>.** <...> Sources: <source B>.

## Non-goals

- <What this agent deliberately does not pursue; a PR that touches one is
  blocked in a Goal review.>

## Watched sources

| Source | Why watched | Checkpoint key |
|---|---|---|
| <url or path> | <one line> | `<key>` |

To add or drop a source, propose it in a marked comment on your State issue;
the user edits this list.

## Hard limits (only the user changes these)

- Shared filing rules and never-write list: `docs/agents/goal-agents.md`
  § Goal agent contract.
- <Agent-specific limit.>

## Session steps

The generic lifecycle is in `docs/agents/goal-agents.md` § Goal agent contract.
Agent-specific steps:

- Start, after the generic steps: <extra step, if any>.
- Work loop: <e.g. Objectives in rank order; for each, process its sources from
  the Checkpoint on>.
- A session is done when <"done" rule>.
- End, after the generic steps: <extra step, if any>.

## Goal review

The generic Goal review session is in `docs/agents/goal-agents.md`
§ Goal agent contract. Agent-specific checks, on top of the closing issues
and the Goal:

- <Check, e.g. "every changed <artifact> still matches <watched source>".>
```

## Appendix B: Draft `docs/agents/goal-agents.md`

A draft the user adopts, edits and commits; the agent never writes this file. Link it from the `## Agent skills` block in CLAUDE.md, for example:

```markdown
### Goal agents

Goal agent contract and the Goal agents in this repo: see `docs/agents/goal-agents.md`.
```

The file:

````markdown
# Goal agents

## Goal agent contract

Every Goal agent in this repo follows these rules. Tracker commands are in
`docs/agents/issue-tracker.md` § Goal agent operations.

### Never write

- Never write `docs/agents/*`, `GLOSSARY.md`, `docs/adr/` or `.out-of-scope/`.
  A term or decision you want recorded is an ordinary `enhancement` issue
  ("add glossary entry X", "record ADR Y").
- Never edit text you did not write. Never move an Order entry or revert the
  user's reordering.
- Your only repository write is `.claude/agent-memory/<name>/`: committed alone,
  directly to `main`, at most once per session, only when it changed, with the
  trailer `Goal-agent: <name>`.
- Memory holds only learnings about how you do your job. A domain term or a
  decision becomes an issue, never a memory entry.

### Marking

- Every issue body and every comment you post starts with
  `> *This was generated by AI: <name> Goal agent.*`
  The State issue body carries no marker; your comments on it do. A Goal
  review comment opens with the Goal review marker, then this one.
- Every issue you file carries `needs-triage` (the only state label you ever
  apply), exactly one of `bug` / `enhancement` (your best guess; every finding
  that is not a defect is `enhancement`), and `goal-agent:<name>`.
- `goal-agent:<name>` marks the agent's scope; the user also applies it to their
  own issues. Only the marker shows who wrote something.

### Issue report template

```markdown
> *This was generated by AI: <name> Goal agent.*

## Observation
<What is the case, in one or two sentences.>

## Evidence
<Links, paths, quotes, command and output, source version; file:line allowed.>

## Why it matters
Objective: <n. Objective name>. <Link to the long-term goal; urgency, if any.>

## Suggested outcome
<A proposal for triage: no acceptance criteria, no Agent Brief.>
```

When the finding won't fit one fresh context window or isn't verifiable on its
own, end Suggested outcome with this sentence, and omit it when unsure:
`Spec-sized: needs a spec and slices before implementation.`
No Spec-sized label, no `Spec:` title prefix.

### State issue

One per Goal agent, labelled `goal-agent:state`, its title naming the agent.
Body sections:

- `## Order`: ordered list of every open issue labelled `goal-agent:<name>`,
  including specs that superseded one of them (the user labels the spec).
  Slices never enter.
- `## Deferred items`: each with its trigger.
- `## Checkpoints`: one entry per watched source, by its Checkpoint key.
- `## Handoff`: only while a note is pending.

Re-read the body right before every write. Prune closed issues; insert new ones
where you recommend; never move an existing entry. A closed issue
"Superseded by <spec>" is replaced by the spec in the same slot. Suggest a
reorder, or a watch-list change, in a marked comment on the State issue.

### Session

Start:

1. Read this file, `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`
   and `GLOSSARY.md`.
2. Check memory: if `CLAUDE_CODE_DISABLE_AUTO_MEMORY` is `1`, or it is not `0`
   and `autoMemoryEnabled` is false in a settings file, report that memory is
   off and stop.
3. Find your State issue. None: create it. More than one: stop and ask. A label
   missing on the tracker: create it only if this file names it.
4. `## Handoff` present: read it, act on it, delete it.
5. Query tracker facts fresh (open issues in scope, labels, blocking edges);
   never copy them into state.
6. Answer open `needs-info` questions on issues you filed, as marked comments;
   touch no labels.
7. Deferred items whose trigger has fired: file them now and remove them from
   `## Deferred items`.

Filing a finding:

1. Search all issues, open and closed, for the same finding. New evidence on an
   open issue: a marked comment.
2. Read the relevant ADRs and `.out-of-scope/`. A match of a past rejection:
   don't file, unless there is new evidence; then file a `needs-triage` issue
   linking the rejection entry and stating what changed.
3. Not actionable until a named external trigger fires: a Deferred item, not an
   issue.
4. Otherwise one finding, one flat issue, with the template above. Never a spec,
   never slices, never split a finding to get under the Spec-sized threshold.
5. Blocking edges only between your own flat issues; never sub-issue links or
   edges on a spec or its slices. A finding touching an in-flight spec is a flat
   issue naming the spec in Evidence.
6. Insert the new issue into `## Order` where you recommend it.

Closing: close your own issue only while it is still `needs-triage`, with a
marked comment saying why. After triage, only comment.

End:

1. Update `## Checkpoints` for every source you processed.
2. Update `## Order` as above.
3. Commit memory if it changed.
4. Only when stopping mid-flow: write `## Handoff` (goal, state, next step,
   links). This overrides any instruction to write a handoff file to a
   scratchpad.

### Goal review session

A PR whose closing references (`Closes`, `Fixes`, `Resolves`) include an issue
labelled `goal-agent:<name>` needs a Goal review by that agent before merge.
`Part of #N` or `Refs #N` does not count. The brief is
`Goal review of PR #<n>`; the PR number is the only input.

1. Run Start steps 1–3 only. Leave `## Handoff`, `needs-info` answers and
   Deferred items to the next regular session; no work loop.
2. Read the PR, its diff and its head SHA, and each closing issue with all its
   comments. A later comment overrides an earlier one; an Agent Brief comment
   is the spec.
3. If a Goal review comment of yours for this head SHA exists, report its
   verdict and stop.
4. Check: (a) each closing issue's request and "done when" criteria are met;
   (b) no drift from your Goal: the changes serve the Goal and its Objectives,
   stay within the closing issues' scope, and touch no Non-goal; (c) the checks
   in your definition's `## Goal review`. Do not check coding standards; that
   is `code-review`'s job.
5. Grade each finding. Blocking: an issue requirement or "done when" not met,
   drift from the Goal, a Non-goal touched, an Objective broken. Everything
   else is non-blocking. The verdict is `blocked` if there is at least one
   blocking finding, else `pass`.
6. Post exactly one PR comment:

   ```markdown
   <!-- goal-agent-review:<name> sha=<40-hex head SHA> verdict=pass|blocked -->
   > *This was generated by AI: <name> Goal agent.*

   **Verdict: pass | blocked**

   ### Blocking
   - <finding>, `path/to/file:line`. <Which requirement, Objective or Non-goal.>

   ### Non-blocking
   - <finding>, `path/to/file:line`.

   ### Follow-ups filed
   - #<n> <title>
   ```

7. File a finding outside the PR's scope as a follow-up issue, as in Filing a
   finding above, and insert it into `## Order`.
8. Commit memory if it changed.
9. Report to the caller: the verdict and findings, at most 300 words.

Your only writes are that comment, follow-up issues, the State issue and
memory. Never approve, request changes, push to the PR branch, merge, or
create tags or releases. Re-review only a new head SHA, and only when the user
asks; never loop review and fix until clean.

## Goal agents in this repo

| Goal agent | Label | Definition |
|---|---|---|
| `<name>` | `goal-agent:<name>` | `.claude/agents/<name>.md` |

`goal-agent:state` labels every Goal agent's State issue. Agents may create a
label from this section with `gh label create` if it is missing on the tracker.
````

## Appendix C: `docs/agents/issue-tracker.md` § Goal agent operations

Ready to paste beside Wayfinding operations. GitHub version:

```markdown
## Goal agent operations

Used by Goal agents (see `docs/agents/goal-agents.md`). The State issue
(`goal-agent:state`), like `wayfinder:*` issues, is not triage work; issues
labelled `goal-agent:<name>` are.

- **State label**: `goal-agent:state`. Each Goal agent's scope label is
  `goal-agent:<name>`, listed in `docs/agents/goal-agents.md`.
- **Create a missing label** (only one named in `goal-agents.md`):
  `gh label create goal-agent:<name> --description "Scope of the <name> Goal agent"`.
- **Find the State issue**: `gh issue list --state open --label goal-agent:state --json number,title --jq '.[] | select(.title | contains("<name>"))'`.
  None: create it. More than one: stop and ask.
- **Create the State issue**: `gh issue create --title "<name> Goal agent: state" --label goal-agent:state --body-file <file>`
  with the sections `## Order`, `## Deferred items`, `## Checkpoints`.
- **Update the State issue**: read the body right before writing
  (`gh issue view <n> --json body --jq .body`), edit it, then
  `gh issue edit <n> --body-file <file>`.
- **Issues in scope**: `gh issue list --state open --label goal-agent:<name> --json number,title,labels,body`.
- **Close an own issue before triage**: `gh issue close <n> --comment "<marked comment>"`.
- **Blocking edges** between the agent's own flat issues: as in Wayfinding
  operations, **Blocking**.
- **Goal review: read the PR**: `gh pr view <n> --json title,body,headRefOid,closingIssuesReferences,comments`
  and `gh pr diff <n>`; each closing issue with `gh issue view <m> --comments`.
- **Goal review: post the verdict**: `gh pr comment <n> --body-file <file>`.
```

The GitLab variant has no Goal review lines: the enforcement in [section 11](#11-goal-review-enforcement) relies on GitHub commit statuses and branch protection, and has no GitLab counterpart yet.

GitLab variant:

```markdown
## Goal agent operations

Used by Goal agents (see `docs/agents/goal-agents.md`). The State issue
(`goal-agent:state`), like `wayfinder:*` issues, is not triage work; issues
labelled `goal-agent:<name>` are.

- **State label**: `goal-agent:state`. Each Goal agent's scope label is
  `goal-agent:<name>`, listed in `docs/agents/goal-agents.md`.
- **Create a missing label** (only one named in `goal-agents.md`):
  `glab label create --name goal-agent:<name> --description "Scope of the <name> Goal agent"`.
- **Find the State issue**: `glab issue list --label goal-agent:state -O json`,
  keep the one whose title contains `<name>`. None: create it. More than one:
  stop and ask.
- **Create the State issue**: `glab issue create --title "<name> Goal agent: state" --label goal-agent:state --description "..."`
  with the sections `## Order`, `## Deferred items`, `## Checkpoints`.
- **Update the State issue**: read the description right before writing
  (`glab issue view <n> -F json`), edit it, then
  `glab issue update <n> --description "..."`.
- **Issues in scope**: `glab issue list --label goal-agent:<name> -O json`.
- **Close an own issue before triage**: post the marked comment with
  `glab issue note <n> --message "..."`, then `glab issue close <n>`.
- **Blocking edges** between the agent's own flat issues: as in Wayfinding
  operations, **Blocking**.
```

## Appendix D: Decisions amended since filing

For readers of the decision tickets: two decisions were amended by later tickets. The body above states only the amended form.

| Original decision | Amended to | Amended by |
|---|---|---|
| [Which shared configuration may a Goal agent read, extend, or own?][8], point 3: the definition holds the agent's Objectives, watched sources, hard limits "and session contract". | The generic session lifecycle lives in the Goal agent contract in `goal-agents.md`; the definition holds only its work loop, "done" rule and extra start and end steps ([R25](#r25)). | [Is the shared Goal agent contract a doc, a preloaded skill, or both?][12], [What does a generic Goal agent definition look like?][13] |
| [How are a Goal agent's issues marked as agent-authored?][9], point 2: `goal-agent:<name>` marks the issues the agent filed (origin). | `goal-agent:<name>` marks the agent's scope; the user also applies it to their own in-scope issues; only the AI marker shows origin ([R10](#r10)). | [What does a generic Goal agent definition look like?][13] |

[1]: https://github.com/hsmejky/goal-agent/issues/1
[2]: https://github.com/hsmejky/goal-agent/issues/2
[3]: https://github.com/hsmejky/goal-agent/issues/3
[4]: https://github.com/hsmejky/goal-agent/issues/4
[5]: https://github.com/hsmejky/goal-agent/issues/5
[6]: https://github.com/hsmejky/goal-agent/issues/6
[7]: https://github.com/hsmejky/goal-agent/issues/7
[8]: https://github.com/hsmejky/goal-agent/issues/8
[9]: https://github.com/hsmejky/goal-agent/issues/9
[10]: https://github.com/hsmejky/goal-agent/issues/10
[11]: https://github.com/hsmejky/goal-agent/issues/11
[12]: https://github.com/hsmejky/goal-agent/issues/12
[13]: https://github.com/hsmejky/goal-agent/issues/13
[14]: https://github.com/hsmejky/ai-plugin-manager/issues/91#issuecomment-6179843112
[15]: adr/0001-local-goal-review-enforced-by-marker-status.md
[16]: https://github.com/hsmejky/ai-plugin-manager/pull/37
[17]: https://github.com/hsmejky/ai-plugin-manager/pull/48
[18]: https://github.com/hsmejky/ai-plugin-manager/pull/52
[19]: https://github.com/hsmejky/ai-plugin-manager/pull/56
[20]: https://github.com/hsmejky/ai-plugin-manager/pull/72
[21]: https://github.com/hsmejky/ai-plugin-manager/pull/79
[22]: https://github.com/hsmejky/ai-plugin-manager/pull/100
