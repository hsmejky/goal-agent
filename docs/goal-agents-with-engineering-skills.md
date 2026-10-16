# Goal agents with the Engineering skills

Recommendations for making a **Goal agent** and the **Engineering skills** work together: every Goal agent runs unattended as a guarded routine on its own **Home repo**, the issues it files in its **Covered repos** are directly workable by the Engineering skills the user runs, the user's sessions consult it through issue comments, its **Goal reviews** start without being asked, and both sides share one configuration that does not conflict (`docs/agents/`, labels, glossary).

Terms in bold are defined in [`GLOSSARY.md`](../GLOSSARY.md) and used as defined there.

## 1. Summary

R1–R37 come from the first design ([map #1][1]); R38–R61 and the edits to R1–R37 come from the one-mode design ([map #29][23], [ADR 0005][48]). Retired recommendations keep their number.

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
| [R10](#r10) | Use `goal-agent:<name>` as the agent's scope label; the user creates it in each Covered repo. |
| [R11](#r11) | Add a `Goal-agent: <name>` trailer to every agent commit. |
| [R12](#r12) | Rank the **Objectives** in the definition; each issue names its Objective. |
| [R13](#r13) | Keep one **Order** across all Covered repos, as blocking edges plus an ordered `owner/repo#n` list the user owns. |
| [R14](#r14) | Use no priority, urgency or objective labels. |
| [R15](#r15) | Keep operational state in one **State issue** per Goal agent, in its Home repo. |
| [R16](#r16) | Keep a **Deferred item** in the State issue until its trigger fires, then file it through triage. |
| [R17](#r17) | Write a handoff note only when stopping mid-flow, in the State issue, never in a scratchpad. |
| [R18](#r18) | Keep learnings as plain files in the Home repo's `memory/`; commit only that directory. |
| [R19](#r19) | Keep no session log and no copies of tracker facts. |
| [R20](#r20) | Read the shared configuration of the Home repo every session and of a Covered repo before working in it. |
| [R21](#r21) | Never write `docs/agents/*`, `GLOSSARY.md`, `docs/adr/`, `.out-of-scope/`, CLAUDE.md or workflows. |
| [R22](#r22) | Put the **Goal agent contract** in the Home repo's `docs/agents/goal-agents.md`; each Covered repo keeps only a registry. |
| [R23](#r23) | Put tracker mechanics, as `gh api` REST calls, in the Home repo's `docs/agents/issue-tracker.md`. |
| [R24](#r24) | Add no `bug`/`enhancement` mapping to `triage-labels.md`. |
| [R25](#r25) | Keep the definition thin: only what is specific to this one agent. |
| [R26](#r26) | Bound the agent with the Home repo guard, not with frontmatter; omit `skills:`. |
| [R27](#r27) | Gate every session on reading the contract, from the routine prompt through the definition, with CLAUDE.md as a second channel. |
| [R28](#r28) | Let the agent propose changes to its definition as **Definition proposals**; the user edits the definition. |
| [R29](#r29) | Require a Goal review for every PR whose body closes an issue labelled `goal-agent:<name>`. |
| [R30](#r30) | Retired: the user's session no longer runs Goal reviews. |
| [R31](#r31) | Start a Goal review like any session, re-check the target, then go to the PR; the closing issues are its spec. |
| [R32](#r32) | Check the closing issues, drift from the Goal, and the agent's own review checks; not coding standards. |
| [R33](#r33) | Grade every finding blocking or non-blocking; any blocking finding blocks the PR. |
| [R34](#r34) | Post exactly one PR comment per reviewed head SHA, opening with the Goal review marker. |
| [R35](#r35) | Write only that comment, follow-up issues, the State issue and memory; never approve, push, merge or tag. |
| [R36](#r36) | Review every new head SHA of a non-draft PR once, without being asked; no review-until-clean loop. |
| [R37](#r37) | Enforce the Goal review with a gate that fires the agent's routine and sets a commit status branch protection requires. |
| [R38](#r38) | Give every Goal agent a dedicated Home repo that is never one of its Covered repos. |
| [R39](#r39) | File each **Finding** in the one Covered repo it concerns; a concern about the Goal goes on the State issue. |
| [R40](#r40) | Give a labelled **Map** one place in the Order; its tickets hold none. |
| [R41](#r41) | Judge each Objective **Met** or open against its "Met when" criterion, in the State issue's `## Progress`. |
| [R42](#r42) | List the Covered repos in the definition's `## Covered repos`; the routine prompt repeats it. |
| [R43](#r43) | Once a day, turn triage outcomes into memory learnings or Definition proposals. |
| [R44](#r44) | Run every Goal agent as a single-repo cloud routine on its Home repo, reaching Covered repos through `add_repo` and `gh api`. |
| [R45](#r45) | Guard the routine with Home repo hooks run from `origin/main`. |
| [R46](#r46) | Run three kinds of session: a fired Goal review, a fired Consultation answer, and the hourly sweep. |
| [R47](#r47) | When blocked, stop and report on the State issue; report a recurring blocker once. |
| [R48](#r48) | Bound spend by run shape, not caps; stop the agent with the routine switch or **Halted**. |
| [R49](#r49) | Make every write idempotent instead of taking a lock. |
| [R50](#r50) | Audit the Home repo's `main`: a commit outside `memory/` that no merged PR brought sets Halted. |
| [R51](#r51) | Keep a `Last run` comment on the State issue and check it daily for staleness. |
| [R52](#r52) | Consult the agent from the user's sessions before deciding an in-scope issue's scope, Objective, Order place or "done when". |
| [R53](#r53) | Ask in one marked question comment on the issue; the agent answers there and only recommends. |
| [R54](#r54) | Fire the routine from a `goal-agent-consult` workflow; the hourly sweep is the backstop. |
| [R55](#r55) | Park the one decision while a background Monitor waits; decide alone after a timeout. |
| [R56](#r56) | Put the Consultation rule inline in each Covered repo's CLAUDE.md `### Goal agents` block. |
| [R57](#r57) | Let several Goal agents cover one repo; their Orders stay independent and each hands off the other's state. |
| [R58](#r58) | Brief Goal agents in the routing guide through Consultation only. |
| [R59](#r59) | Add or remove a Covered repo, or retire an agent, by the user's checklists. |
| [R60](#r60) | Pilot the design with `goal-steward` on real work. |
| [R61](#r61) | Migrate `plugin-maintainer` to its own Home repo after the pilot, by a checklist. |

## 2. Scope and terms

**In scope.** How a Goal agent runs unattended as a guarded routine on its Home repo ([section 12](#12-running-unattended)); how it files, marks, orders and tracks issues in its Covered repos so that the Engineering skills (`triage`, `to-spec`, `to-tickets`, `implement`, `implement-spec`, `tdd`, `code-review`, `wayfinder`) can work them, and which shared files each side reads or writes; how the user's sessions consult it through issue comments ([section 13](#13-consultation)); the **Goal review** of a pull request that closes one of its issues ([section 10](#10-goal-review)), fired by a gate in each Covered repo ([section 11](#11-goal-review-enforcement)); several agents on one Covered repo, the routing guide, adding and removing Covered repos, the `goal-steward` pilot and the migration of `plugin-maintainer` (sections [14](#14-several-goal-agents-on-one-covered-repo)–[16](#16-pilot-and-migration)). The pattern is general; it applies to any Goal agent and any Covered repo with the Engineering skills set up. There is one mode: every Goal agent is a routine on a dedicated Home repo, even when its Goal covers one repo ([ADR 0005][48]).

**Out of scope** (from [map #1][1] and [map #29][23]): a Goal agent doing engineering work or invoking Engineering skills itself (a Goal review and a Consultation answer are in scope, but the agent still invokes no skill, [R26](#r26)); the user's sessions running a Goal agent (they consult it through issues, [R52](#r52)); Codex; changing the Engineering skills; automatic merge; the agent editing its own Goal or definition ([R28](#r28)); a setup script for Covered repos (the checklists in [R59](#r59) are enough); packaging the Goal agent contract as a preloaded skill (see [section 17](#17-trial-run)).

**Terms.** Goal agent, Goal agent session, Engineering skills, Objective, Met, Non-goal, Finding, Order, Spec-sized, Map, Goal agent contract, Goal review, Consultation, Covered repo, Home repo, State issue, Checkpoint, Deferred item, Halted and Definition proposal: see [`GLOSSARY.md`](../GLOSSARY.md). A *session* is any Goal agent session, scheduled or fired; whatever the contract says about "the next session" holds for each. Triage terms (category label, state label, Agent Brief, reporter) are the `triage` skill's. *Routine*, *API trigger* and *fire* are Claude Code's cloud routine terms.

**Sources.** Each recommendation has a *Why:* and a *Source:* line. Decision tickets are linked by name. Skill paths are relative to `~/.claude/plugins/cache/mattpocock/mattpocock-skills/1.3.1/` (**mattpocock-skills 1.3.1**). Evidence from the `plugin-maintainer` Goal agent in [`hsmejky/ai-plugin-manager`](https://github.com/hsmejky/ai-plugin-manager) refers to commit `e191536`; it appears only as evidence, not as a worked example. Where a later ticket narrowed an earlier one, the body states only the result; [Appendix D](#appendix-d-decisions-amended-since-filing) lists the amendments.

## 3. Where everything lives

<a id="r1"></a>
**R1. Give every piece of Goal agent configuration and state exactly one home, as in the table below.**

| Home | Holds | Written by | Read by |
|---|---|---|---|
| Definition `.claude/agents/<name>.md` in the Home repo | Read-first gate, Goal, ranked Objectives with "Met when" criteria, Non-goals, `## Covered repos`, watched sources with Checkpoint keys, agent-specific hard limits, session steps and Goal review checks ([R25](#r25)) | User, through PRs | The Goal agent, the guard |
| Home repo `docs/agents/goal-agents.md` § Goal agent contract | Session lifecycle, Goal review and Consultation sessions, report template, labels the agent applies, AI marker, never-write list, memory rule, State issue structure, stop-and-report rule, commit trailer ([Appendix B](#appendix-b-draft-docsagentsgoal-agentsmd-in-the-home-repo)) | User, through PRs | The Goal agent |
| Home repo `docs/agents/issue-tracker.md` § Goal agent operations | `gh api` REST calls: State issue, issues in scope, Findings, blocking edges, PRs, comments ([Appendix C](#appendix-c-docsagentsissue-trackermd--goal-agent-operations-in-the-home-repo)) | User, through PRs | The Goal agent |
| Home repo `.claude/settings.json` and `scripts/` (the pinned copy of `scripts/guard`, `scripts/gate` and `scripts/home`, the hooks' code) | The guard: `SessionStart` and `PreToolUse` hooks ([R45](#r45)) | User, through PRs | Claude Code |
| Home repo workflows | The audit of `main` ([R50](#r50)) and the daily staleness check ([R51](#r51)) | User, through PRs | GitHub Actions |
| Home repo CLAUDE.md | Pointer to the contract and the Home repo's own rules for the user's sessions there | User, through PRs | Claude Code |
| Home repo copies of the guard, gate and Consultation scripts | The scripts the hooks and workflows run, copied by the Home repo setup steps from the tested source in the goal-agent repo and pinned to a goal-agent commit or tag, recorded in the definition's `goal-agent-pin` field ([ADR 0006][50]) | User, through PRs | Claude Code, GitHub Actions |
| Routine (claude.ai) | Hourly schedule, API trigger, prompt naming the owner, the Covered repos and the writes ([R44](#r44), [Appendix F](#appendix-f-routine-prompt)) | User | Claude Code |
| State issue in the Home repo (label `goal-agent:state`) | Order, Deferred items, Checkpoints, Progress, pending handoff note, halt marker ([R15](#r15)); the `Last run` comment ([R51](#r51)); Definition proposals and blocker reports as comments | Goal agent and user | Goal agent, user, the guard |
| Home repo `memory/` | Learnings about how the agent does its own job, never naming a Covered repo ([R18](#r18)) | Goal agent | Goal agent |
| Covered repo `docs/agents/goal-agents.md` § Goal agents in this repo | Registry: each Goal agent covering the repo, its `goal-agent:<name>` label, its Home repo ([R22](#r22), [Appendix E](#appendix-e-covered-repo-files)) | User | User's sessions |
| Covered repo CLAUDE.md `### Goal agents` block | Pointer to the registry and the inline Consultation rule ([R56](#r56)) | User | User's sessions |
| Covered repo tracker (issues, labels, blocking edges, comments) | Everything else: Findings, triage state, dependencies, Consultations | Goal agent, user, Engineering skills | Everyone |
| PR comment opening with the Goal review marker | One Goal review: verdict and findings for one head SHA ([R34](#r34)) | Goal agent | User, the gate |
| Covered repo `.github/workflows/goal-agent-review.yml` and `goal-agent-consult.yml`, plus per-agent fire secret and trigger id | The gate that fires Goal reviews and sets the `goal-agent-review` status ([R37](#r37)); the workflow that fires Consultation answers ([R54](#r54)) | User | GitHub Actions, branch protection |

*Why:* copies drift. In `plugin-maintainer`, the definition restated its own issue shape and P1–P4 labels, and both drifted away from what the skills read; its committed `state.md` copied tracker facts and was stale within a day. One home per item also means the user can change a shared convention in one place. Everything about the agent itself sits in its Home repo, and the Home repo holds nothing else, no product code; a Covered repo holds only what the user's sessions and the gate need there.
*Source:* [Which shared configuration may a Goal agent read, extend, or own?][8], as amended by [Is the shared Goal agent contract a doc, a preloaded skill, or both?][12] and [What does a generic Goal agent definition look like?][13]; [Where does a Goal agent keep its state?][7]; [How have plugin-maintainer's issues fared with the Engineering skills?][3]; [Where does a cross-repo Goal agent live?][26]; [Which routine shape runs the cross-repo Goal agent?][38]; [What does adding or removing a Covered repo involve?][43]; [ADR 0005][48].

<a id="r38"></a>
**R38. Give every Goal agent a dedicated Home repo, one per agent, that holds the agent itself (its definition, State issue and memory, and the machinery that runs and bounds it: the contract, tracker docs, hooks, workflows and CLAUDE.md) and no product code, and that is never one of its Covered repos. The Home repo is set up like any repo with the Engineering skills and is the only source of the contract the agent follows.**

- This holds for a Goal agent that covers a single repo too.
- The user changes the Home repo's definition, contract, workflows and hooks only through PRs ([R50](#r50)); the agent pushes only `memory/` ([R18](#r18)).

*Why:* a dedicated repo favours no Covered repo, keeps the agent's State issue and memory commits out of their trackers and history, and does not move when a Covered repo is added or removed. Using the only Covered repo as home was rejected: the audit of `main` would flag every ordinary merge there, and adding a second Covered repo would mean moving the agent. User-level definitions were rejected because a routine starts on a fresh VM where nothing under `~/.claude` exists.
*Source:* [Where does a cross-repo Goal agent live?][26] ([ADR 0002][45]); [Can one subagent definition and its memory serve sessions in every Covered repo?][25]; [Should every Goal agent run in cross-repo mode?][44] ([ADR 0005][48]).

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

The template is in [Appendix B](#appendix-b-draft-docsagentsgoal-agentsmd-in-the-home-repo).

*Why:* the Agent Brief is triage's output and "the contract"; a report gives triage what it needs without pre-empting it. Paths are fine in a report because the brief, which bans them as stale-prone, is written later. `plugin-maintainer` used its own Gap/Evidence/Done-when shape, so no issue had a brief or an out-of-scope section.
*Source:* [Should a Goal agent's issues enter through triage or arrive ready-for-agent?][5]; `skills/engineering/triage/AGENT-BRIEF.md`; [How have plugin-maintainer's issues fared with the Engineering skills?][3].

<a id="r4"></a>
**R4. File flat issues only; when a finding is Spec-sized, end Suggested outcome with the fixed sentence `Spec-sized: needs a spec and slices before implementation.`**

- The threshold is `to-tickets`'s own sizing rule: it won't fit one fresh context window, or isn't verifiable on its own. The agent judges when filing; triage decides. When unsure, omit the sentence. A Finding that needs work in more than one Covered repo is Spec-sized ([R39](#r39)).
- No Spec-sized label, no `Spec:` title prefix.
- The user runs `to-spec` with the flat issue as context, labels the spec `goal-agent:<name>`, runs `to-tickets`, then closes the flat issue with `Superseded by <spec>`. The spec takes the flat issue's slot in the Order ([R13](#r13)). The user's session gives each slice the spec's `goal-agent:<name>` label ([R56](#r56)), so a PR that closes a slice gets a Goal review ([R29](#r29)); slices still never enter the Order.

*Why:* slicing is design work and belongs to the user's session. In `ai-plugin-manager`, only the spec path (#71 with slices #64–#70, PR #72) showed the Engineering shape end to end, and it started from a flat issue (#60: "There is no spec, so no slice can be run"). `implement-spec` reads no labels, so slices the agent filed would run untriaged. The inherited label is what lets the gate find the agent for a slice's PR; the skills stay unchanged because the session, not `to-tickets`, adds it.
*Source:* [Should a Goal agent file flat issues or a spec with sliced tickets?][10]; [How do the user's sessions consult the agent through issues?][30] (label inheritance); [Where do wayfinder maps in Covered repos sit in the Order?][31]; `skills/engineering/to-tickets/SKILL.md:33`; `skills/engineering/implement-spec/SKILL.md`; [ai-plugin-manager#60](https://github.com/hsmejky/ai-plugin-manager/issues/60), [#71](https://github.com/hsmejky/ai-plugin-manager/issues/71).

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

<a id="r39"></a>
**R39. File each Finding in the one Covered repo it concerns, through that repo's triage; a Finding that spans repos goes to the repo where the change must land first; a concern about the Goal or the definition itself is never filed, but posted as a marked comment on the State issue.**

- The agent uses that repo's `docs/agents/triage-labels.md`. If the repo lacks the `goal-agent:<name>` label or its triage docs, the agent stops and reports ([R47](#r47)); it never creates them ([R10](#r10)).
- A multi-repo Finding stays one issue ([R5](#r5)) and is Spec-sized ([R4](#r4)).
- Before filing, search the open and closed issues of every Covered repo for the same finding. When an open issue, whoever filed it and whatever its labels, already covers the gap, post a marked comment on it naming the Objective and file nothing; never add or remove a label on an issue the agent did not file.
- A concern about the Goal or the definition (conflicting Objectives, a "Met when" that cannot be measured) names no Covered repo; it is addressed to the user on the State issue, and a recurring one is reported once.
- A Deferred item names its target repo. When that repo is no longer covered, the agent drops the item with a marked comment on the State issue.

*Why:* a Finding has to be worked where the change lands, under that repo's triage and labels; one issue per finding keeps one triage pass. The duplicate search across repos and agents keeps two agents, or two runs, from filing the same gap. Goal-level concerns have no repo to land in and are about the agent itself, like a watch-list change ([R28](#r28)).
*Source:* [Where are findings filed, and how is one Order kept across repos?][27]; [How does a cross-repo Goal agent coexist with a single-repo Goal agent in the same repo?][40] (dedupe by comment); [What does adding or removing a Covered repo involve?][43].

## 5. Marking agent output

<a id="r9"></a>
**R9. Open every issue body and every comment the agent writes with `> *This was generated by AI: <name> Goal agent.*`**

- Same tracker account as the user; a bot account or GitHub App per agent is an optional upgrade, not required. A routine posts as the user.
- The marker means origin, not endorsement. It stays when the user edits the issue; endorsement is the triage transition. The agent never edits text it did not write.
- The State issue body carries no marker (it is co-edited and identified by its label and title); the agent's comments on it do.
- A Goal review comment puts the hidden Goal review marker on its first line and this AI marker on the next, so the AI marker is still the first visible line ([R34](#r34)).

*Why:* in `plugin-maintainer`, authorship was unrecoverable: one account, no disclaimer anywhere. The shared prefix with triage's `> *This was generated by AI during triage.*` finds all AI output with one search, and the different ending lets triage tell a reporter reply from its own notes. Naming the agent tells several Goal agents apart. A separate identity would cost a second account, token handling and `gh` under different auth.
*Source:* [How are a Goal agent's issues marked as agent-authored?][9]; `skills/engineering/triage/SKILL.md:13-16`; [How have plugin-maintainer's issues fared with the Engineering skills?][3]; [Can a gate workflow fire a routine that posts a Goal review comment?][35] (routine posts as the user).

<a id="r10"></a>
**R10. Use `goal-agent:<name>` as the agent's scope label: the agent puts it on every issue it files, the user puts it on their own issues in the agent's scope, and the user creates it in each Covered repo when adding that repo ([R59](#r59)). The agent never creates a label.**

- A missing label in a Covered repo is a blocker: the agent stops and reports ([R47](#r47)).
- In the user's sessions, `/triage` asks whether an issue belongs to the Goal before the label goes on; issues created by `/to-spec` or `/to-tickets` inherit it from their parent ([R56](#r56)).

*Why:* the Order covers every open issue in the agent's scope, user-filed ones included ([R13](#r13)); a label makes that scope deterministic and cheap to query, and the AI marker already shows origin. No Engineering skill reads the label, so it cannot disturb them. `state` is reserved (`goal-agent:state`). Creating labels is checklist work in a repo the agent does not own; it belongs to the user's checklist, and the guard allows the agent no write outside `issues…` anyway ([R45](#r45)).
*Source:* [How are a Goal agent's issues marked as agent-authored?][9], as amended by [What does a generic Goal agent definition look like?][13]; [What does adding or removing a Covered repo involve?][43] (the user creates the label); [How do the user's sessions consult the agent through issues?][30].

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
**R13. Keep one Order per agent, spanning all its Covered repos, as native blocking edges where a real dependency exists and otherwise as an ordered list in the State issue's `## Order`; the Order is a recommendation the user owns.**

- Every entry is a full `owner/repo#n` reference, never a bare `#n`.
- It covers every open issue labelled `goal-agent:<name>` in every Covered repo, user-filed included (placed by the user's stated priority, else by Objective rank), except an issue whose parent is a spec or Map in the Order. A spec that superseded one of them carries the label too ([R4](#r4)) and takes its slot (substitution, not reordering); slices never enter the Order; the spec leaves when it closes. A labelled Map holds one place ([R40](#r40)).
- The agent re-reads the body right before every write ([R15](#r15)), prunes closed issues, and inserts new ones where it recommends. When a pruned issue was closed `Superseded by <spec>`, the agent puts the spec in its slot; this is the substitution, so the slot survives even if the user has not edited the Order yet. It never moves an existing entry and never reverts the user's reordering. A suggested reorder goes in a marked comment on the State issue.
- Blocking edges work across repos. The agent judges whether an issue is blocked from its `dependencies/blocked_by` list and each blocker's state, not from the lagging `issue_dependencies_summary`.
- A transferred issue: when its new repo is covered, the agent rewrites the reference in the same slot; otherwise it removes the entry with a marked comment.
- The user reorders in the GitHub UI, without a commit.

*Why:* native blocking edges are the only ordering the Engineering skills read (the `wayfinder` and `implement-spec` frontier). An ordered list in a user-editable issue keeps the user in charge of what runs next. `plugin-maintainer`'s `state.md` "What next" already held an explicit order, but in a file that went stale. One Goal means one Order, whichever repo an issue lives in; a full reference is unambiguous in a State issue that lives in another repo.
*Source:* [Where does a Goal agent's priority axis live?][6]; [Where does a Goal agent keep its state?][7]; [Should a Goal agent file flat issues or a spec with sliced tickets?][10]; [What does a generic Goal agent definition look like?][13] (scope by label); [Where are findings filed, and how is one Order kept across repos?][27]; [Where do wayfinder maps in Covered repos sit in the Order?][31]; `skills/engineering/wayfinder/SKILL.md`, `skills/engineering/to-tickets/SKILL.md`.

<a id="r14"></a>
**R14. Use no priority, urgency or objective labels; state urgency in Why it matters and express it as an earlier position in the Order.**

*Why:* no Engineering skill reads priority. `plugin-maintainer`'s P1–P4 drifted from category to rank (18 of 38 issues P4, #53 P2 against its own table) and was dropped from #64–#70.
*Source:* [Where does a Goal agent's priority axis live?][6]; [How have plugin-maintainer's issues fared with the Engineering skills?][3]; `ai-plugin-manager: docs/agents/triage-labels.md` (Priority labels section).

<a id="r40"></a>
**R40. The user may label a wayfinder Map in a Covered repo `goal-agent:<name>`; a labelled Map serves one Objective and holds one place in the Order until it closes. Its tickets hold none.**

- Only the user adds the label to a Map, never the agent. It is a scope label, not a triage label; the Map still carries only its `wayfinder:*` labels for triage.
- A Map's decision tickets never carry the label, never enter the Order and never get a Consultation. Execution tickets in a Map whose Notes carry execution follow the spec-slice rules ([R4](#r4)), Goal review included.
- `/wayfinder` charting consults the agent ([R52](#r52)) with the Destination as "done when": on the idea issue charting started from or, when it started from a loose idea, on the Map right after it is created and before any tickets; again whenever the Destination is redrawn. The agent never comments on a Map unprompted. The Destination is advice only and binds no Goal review (no PR closes a Map).
- When `/to-spec` turns the Map's result into a spec, the spec's Consultation recommends the Map's former place, naming the Map. A decision or an in-place change with no spec passes no place on.

*Why:* a Map is one piece of work toward one outcome; giving each ticket a place would flood the Order with decisions the user charts, not work the agent recommends. The handoff to the spec keeps the slot, as substitution does for a superseded flat issue.
*Source:* [Where do wayfinder maps in Covered repos sit in the Order?][31]; `skills/engineering/wayfinder/SKILL.md`.

## 7. State

<a id="r15"></a>
**R15. Keep operational state in one State issue per Goal agent, in its Home repo, labelled `goal-agent:state`, with the agent's name in its title and the body sections `## Order`, `## Deferred items`, `## Checkpoints`, `## Progress`, and `## Handoff` only while a note is pending.**

- The agent creates it on its first session if missing. If more than one matches, it stops and reports ([R47](#r47)).
- `## Checkpoints` has one entry per watched source, keyed as in the definition ([R25](#r25)). `## Progress` is described in [R41](#r41).
- The body also carries the halt marker while the agent is Halted ([R48](#r48)); only the user or the audit writes it, and the agent's body writes keep it.
- The agent writes the body only when the Order, Deferred items, Checkpoints, Progress or Handoff change; `Last run` is a comment ([R51](#r51)). Every body write: read the body, compute the change, re-read; if `updated_at` moved, re-apply the agent's own change to the fresh body; write, re-read to verify, retry once.
- The State issue is not triage work ([R23](#r23)); the agent's Findings, which carry `goal-agent:<name>`, are.

*Why:* the readers of state are the agent and the user (no Engineering skill reads it), so every part the user acts on must be easy to read and edit; an issue renders linked issues with title and state and needs no commit. A non-triage label keeps it out of triage's "Unlabeled" bucket. In the Home repo it favours no Covered repo ([R38](#r38)). The user edits it at any time and runs can overlap, so a write must not clobber an edit made since the read. Rejected: a committed `state.md` for everything (`plugin-maintainer`'s went stale within a day and took 18 direct commits in one day) and GitHub Projects (setup, token scope, outside the issue list).
*Source:* [Where does a Goal agent keep its state?][7]; [Which shared configuration may a Goal agent read, extend, or own?][8]; [How have plugin-maintainer's issues fared with the Engineering skills?][3]; `ai-plugin-manager: state.md`; [Where are findings filed, and how is one Order kept across repos?][27] (body writes); [How does the agent measure progress on a cross-repo Goal?][34]; [Which safeguards bound an unattended agent?][33].

<a id="r16"></a>
**R16. Keep a Deferred item, with its trigger, in the State issue's `## Deferred items`; the first session after the trigger fires files it through triage and removes the entry.**

*Why:* no triage role means "waiting on an external event", so a Deferred item filed early would sit in the queue with nothing to decide.
*Source:* [Where does a Goal agent keep its state?][7].

<a id="r17"></a>
**R17. Write a handoff note only when a session stops mid-flow, in the State issue's `## Handoff`, never in a scratchpad file; the next session reads it, acts on it and deletes it.**

*Why:* the next session starts on a fresh VM, which a temporary scratchpad does not survive. The contract states this override explicitly because a user's global instructions may prescribe a scratchpad handoff. The read-and-delete rule comes from chief-of-staff.
*Source:* [Where does a Goal agent keep its state?][7], as amended by [What does a generic Goal agent definition look like?][13]; [What do chief-of-staff and claude-handoff do, and how do they overlap with a Goal agent?][4]; [What changes in the contract when nobody is at the session?][28] (unchanged unattended).

<a id="r18"></a>
**R18. Keep learnings as plain files in the Home repo's `memory/`; treat it as required, read it explicitly at session start, and commit only that directory, alone, directly to `main`, at most once per session and only when it changed, with the `Goal-agent:` trailer.**

- Memory holds only how the agent does its own job (where a source lives, a quirk of a tool) and lessons that apply across the Goal. It never names a Covered repo: a fact about one repo lives in the definition's `## Covered repos`, the State issue or that repo's own docs. A learning that is a domain term or a decision becomes an issue ([R21](#r21)).
- A `wontfix` closing reason or a `needs-info` answer on one of the agent's Findings becomes a memory learning ([R43](#r43)).
- At session start: if `memory/` is missing or unreadable, the agent stops and reports ([R47](#r47)) instead of running without it.
- The push is its own command and touches only `memory/` ([R45](#r45)). A non-fast-forward push is rebased and retried once ([R49](#r49)).

*Why:* a routine starts from a fresh clone of the Home repo, so learnings survive only if committed there; nothing under `~/.claude` persists, and frontmatter `memory:` is not what a routine session loads, so the agent reads the files itself. One narrow commit right keeps the agent out of code, docs and configuration, and the guard makes it a hard limit. Memory that names no Covered repo never goes stale when one is added or removed.
*Source:* [Where does a Goal agent keep its state?][7], as amended by [Which shared configuration may a Goal agent read, extend, or own?][8] (no domain terms in memory); [What changes in the contract when nobody is at the session?][28] (plain files, presence check); [Where does a cross-repo Goal agent live?][26] (never names a Covered repo); [Which routine shape runs the cross-repo Goal agent?][38] (`memory/`, guard); [How are a Goal agent's issues marked as agent-authored?][9] (trailer).

<a id="r19"></a>
**R19. Keep no session log and no copies of tracker facts; query open issues, labels, blocking edges and `needs-info` fresh every session. The one exception is the agent's own judgements in `## Progress` ([R41](#r41)).**

*Why:* what a session did is already in the tracker and `git log`. `plugin-maintainer`'s `state.md` "What next" listed four closed issues and missed #64–#71 and PR #72 within one day. A Met verdict is a judgement, not a tracker fact, so it cannot be queried and has to be kept.
*Source:* [Where does a Goal agent keep its state?][7]; [How have plugin-maintainer's issues fared with the Engineering skills?][3]; [How does the agent measure progress on a cross-repo Goal?][34].

<a id="r41"></a>
**R41. Give each Objective a "Met when" criterion in the definition; the agent judges each Objective Met or open and records the verdict in the State issue's `## Progress`, one line per Objective in rank order: `<n>. <Objective> — met | open — judged <time> — <evidence>`.**

- The user may override a verdict with `met (set by user)` or `open (set by user)`; the agent never overwrites an override.
- Every verdict change, met to open included, also gets a marked comment on the State issue.
- The agent measures only in a session that sees a closed `goal-agent:<name>` issue, a merged PR in a Covered repo, or a change to the definition since the last measurement.
- An Objective without a criterion reads `no criterion`; the agent reports it once as a recurring blocker ([R47](#r47)) and never writes a criterion.
- A Met Objective gets no new Findings; its open issues keep their place in the Order. Goal reviews still check every Objective ([R33](#r33)).
- When every Objective is Met, the agent posts one marked "Goal reached" comment on the State issue, files no more Findings, and keeps running Goal reviews and answering Consultations. Retiring the agent is the user's call ([R59](#r59)); the agent never halts itself.

*Why:* without a criterion an unattended agent has no way to tell when it is done, and would keep filing. Measuring only when work lands keeps the hourly run cheap. The marked comment tells the user about a change without reading the body.
*Source:* [How does the agent measure progress on a cross-repo Goal?][34].

## 8. Shared configuration

<a id="r20"></a>
**R20. Read the shared configuration on the same triggers the Engineering skills use: the Home repo's `docs/agents/goal-agents.md` and `issue-tracker.md` every session; a Covered repo's `docs/agents/triage-labels.md` and `GLOSSARY.md` before filing in or reviewing for that repo; its relevant ADRs and `.out-of-scope/` before filing in an area.**

- A Covered repo's files are fetched by path through `gh api` ([R44](#r44)); the Home repo's are read from its clone.

*Why:* the agent files issues in each Covered repo under that repo's labels and terms, so it needs them there; ADRs and rejections matter only for the area at hand. The contract and tracker commands are the agent's own and live once, in the Home repo. `docs/agents/domain.md` says where the glossary and ADRs live.
*Source:* [Which shared configuration may a Goal agent read, extend, or own?][8]; [Is the shared Goal agent contract a doc, a preloaded skill, or both?][12]; [Where does a cross-repo Goal agent live?][26]; [Where are findings filed, and how is one Order kept across repos?][27]; `docs/agents/domain.md`.

<a id="r21"></a>
**R21. In no repo write `docs/agents/*`, `GLOSSARY.md`, `docs/adr/`, `.out-of-scope/`, CLAUDE.md or workflows; a term or decision the agent wants recorded goes through triage as an ordinary `enhancement` issue ("add glossary entry X", "record ADR Y").**

*Why:* every Engineering skill treats these files as authoritative, so an agent write would silently change how the other skills behave. Today only `setup-matt-pocock-skills` writes `docs/agents/`, `domain-modeling` and `improve-codebase-architecture` write the glossary and ADRs, and only `triage` writes `.out-of-scope/`. CLAUDE.md carries the Consultation rule the user's sessions follow ([R56](#r56)), and the workflows carry the gate. This extends `plugin-maintainer`'s existing rule "Write only `state.md` and issues". The guard denies these writes in the Home repo and every repository write outside `issues…` elsewhere ([R45](#r45)).
*Source:* [Which shared configuration may a Goal agent read, extend, or own?][8]; [Should a Goal agent's issues enter through triage or arrive ready-for-agent?][5]; [How do the user's sessions consult the agent through issues?][30] (CLAUDE.md); `ai-plugin-manager: .claude/agents/plugin-maintainer.md:60`.

<a id="r22"></a>
**R22. Put the Goal agent contract in one user-written document in the Home repo, `docs/agents/goal-agents.md` § `## Goal agent contract`, linked from the Home repo's CLAUDE.md. Each Covered repo keeps its own `docs/agents/goal-agents.md` with only `## Goal agents in this repo`: the registry of the agents that cover it. It is a doc, not a preloaded skill.**

*Why:* one file to read and one link from CLAUDE.md. The agent runs in its Home repo, which is the only source of its contract ([R38](#r38)); a copy in each Covered repo would drift. The registry stays in each Covered repo because the user's sessions there need to know which agents to consult and where they live. The user writes both because `docs/agents/` is user-owned configuration ([R21](#r21)); [Appendix B](#appendix-b-draft-docsagentsgoal-agentsmd-in-the-home-repo) and [Appendix E](#appendix-e-covered-repo-files) are starting points. Preloading through `skills:` is harness-guaranteed, unlike a read instruction, but the trial run showed the doc is enough ([section 17](#17-trial-run)).
*Source:* [Is the shared Goal agent contract a doc, a preloaded skill, or both?][12]; [What does a subagent's skills: frontmatter load, and when?][11]; [Which shared configuration may a Goal agent read, extend, or own?][8]; [Where does a cross-repo Goal agent live?][26]; [How does a cross-repo Goal agent coexist with a single-repo Goal agent in the same repo?][40] (registry row with Home repo).

<a id="r23"></a>
**R23. Put tracker mechanics in a `## Goal agent operations` section of the Home repo's `docs/agents/issue-tracker.md`, beside Wayfinding operations: the State label and how to find, create and update the State issue, how to read and write issues, comments, blocking edges and PRs in the Covered repos, and the rule that the State issue (`goal-agent:state`) is not triage work. Every call is `gh api` REST.**

- The agent never creates a label ([R10](#r10)); a missing one is a blocker.

*Why:* commands are tracker-specific and the contract is not; keeping them apart keeps the contract readable. In a cloud session `gh issue` and `gh pr` fail because GraphQL is blocked, so every call is REST, against attached repos only. Triage's first bucket is "Unlabeled", so a State issue needs the explicit exclusion. It names `goal-agent:state` only: a wildcard `goal-agent:*` would also match the scope label every finding carries and take the findings out of triage ([R2](#r2)). There is no GitLab variant: the routine reaches Covered repos only through the GitHub proxy and `gh api` ([R44](#r44)).
*Source:* [Which shared configuration may a Goal agent read, extend, or own?][8]; [Is the shared Goal agent contract a doc, a preloaded skill, or both?][12]; [What changes in the contract when nobody is at the session?][28] (REST); [What does adding or removing a Covered repo involve?][43] (no label creation); `docs/engineering/triage.md:78`; `skills/engineering/triage/SKILL.md:60`.

<a id="r24"></a>
**R24. Add no `bug`/`enhancement` mapping to `docs/agents/triage-labels.md`; add one, in that shared file, only in a repo that renames them.**

*Why:* `triage` uses those literal names, `setup-matt-pocock-skills` never asks about them, and GitHub creates both in every new repo.
*Source:* [Which shared configuration may a Goal agent read, extend, or own?][8]; `skills/engineering/triage/SKILL.md:26-30`.

## 9. The Goal agent definition

<a id="r25"></a>
**R25. Keep the definition thin: the read-first gate, Goal, ranked Objectives each with a "Met when" criterion, Non-goals, `## Covered repos` ([R42](#r42)), watched sources each with a Checkpoint key, agent-specific hard limits, agent-specific session steps (work loop, "done" rule, extra start and end steps), and agent-specific Goal review checks ([R32](#r32)), and the `goal-agent-pin` frontmatter field that records the goal-agent tag or commit the Home repo's copied scripts came from ([ADR 0006][50]). Everything generic lives in the Goal agent contract.**

*Why:* sections 3–8 put every shared rule in `goal-agents.md` or `issue-tracker.md`; a definition that restated them would drift, as `plugin-maintainer`'s brief shape and P1–P4 labels did. The generic session lifecycle is the same for every Goal agent, so it is in the contract and the definition only fills in its hooks. [Appendix A](#appendix-a-definition-skeleton) is the skeleton.
*Source:* [What does a generic Goal agent definition look like?][13]; [Which shared configuration may a Goal agent read, extend, or own?][8], as amended by [Is the shared Goal agent contract a doc, a preloaded skill, or both?][12] and [What does a generic Goal agent definition look like?][13] (session lifecycle in the contract); [How does the agent measure progress on a cross-repo Goal?][34]; [What does adding or removing a Covered repo involve?][43].

<a id="r26"></a>
**R26. Bound the agent with the Home repo guard ([R45](#r45)), not with frontmatter: the guard denies the Skill tool and every write outside the agent's write set. Omit `skills:`.**

*Why:* the routine session follows the definition as its instructions; frontmatter limits such as `disallowedTools: Skill`, `tools` or `memory:` are not enforced there. Unlisted skills would stay invocable through the Skill tool, and running `/triage`, `/to-tickets` or other Engineering skills is out of scope for the agent, so the guard denies the tool. `skills:` stays empty because the contract is not preloaded ([R22](#r22)). The file boundary, which the trial left to prose ([section 17](#17-trial-run)), is now enforced as well.
*Source:* [What does a generic Goal agent definition look like?][13]; [What does a subagent's skills: frontmatter load, and when?][11]; [Where does a cross-repo Goal agent live?][26] (frontmatter not enforced); [Which routine shape runs the cross-repo Goal agent?][38] ("enforced by the Home repo guard").

<a id="r27"></a>
**R27. Gate every session on the contract: the routine prompt tells the agent to read its definition and act as that agent; the definition opens with a hard gate, "Read `docs/agents/goal-agents.md` first, every session; if you cannot, stop and report"; the Home repo's CLAUDE.md links `goal-agents.md` from its `## Agent skills` block as a second channel.**

*Why:* a pointer-only definition rests on a read instruction, which the harness does not guarantee; an agent that skipped it would file unmarked, unlabelled issues and recreate `plugin-maintainer`'s failures. The routine runs in the Home repo, so its CLAUDE.md loads and the link reaches the agent even if it skips the instruction.
*Source:* [What does a generic Goal agent definition look like?][13]; [What does a subagent's skills: frontmatter load, and when?][11]; [Is the shared Goal agent contract a doc, a preloaded skill, or both?][12]; [What changes in the contract when nobody is at the session?][28] (stop and report).

<a id="r28"></a>
**R28. Let the agent propose changes to its own definition (a watched source to add or drop, an Objective, a "Met when" criterion, a Non-goal) as a Definition proposal: a marked comment on its State issue with the evidence. The user edits the definition or declines.**

*Why:* the definition is the user's; the agent never writes it ([R38](#r38)), and the guard denies it ([R45](#r45)). A change to the definition is about the agent itself, not project work, so the triage queue is the wrong place for it.
*Source:* [What does a generic Goal agent definition look like?][13]; [Where does a Goal agent keep its state?][7]; [How do triage outcomes feed back into the definition?][32] (generalised to every definition change).

<a id="r42"></a>
**R42. List the Covered repos in the definition's `## Covered repos` section, one `- owner/repo` line each; the guard parses only that section. The routine prompt names the same repos, and the user changes both together.**

- At the start of every session the agent compares the two lists, works only on their intersection, and reports a mismatch once on the State issue as a recurring blocker ([R47](#r47)).

*Why:* the guard needs the list to bound writes, and the auto-mode classifier passes a Covered repo write only when the prompt names it, and the hourly sweep has no payload. Two copies can drift, so the agent checks them; a mismatch fails safe in both directions, because the guard or the classifier denies the write.
*Source:* [What does adding or removing a Covered repo involve?][43]; [Can a single-repo routine reach its Covered repos past the auto-mode classifier?][37]; [Which routine shape runs the cross-repo Goal agent?][38].

<a id="r43"></a>
**R43. Once a day, count per-Objective signals from the Findings closed since the last count, and turn a single outcome into a memory learning and a pattern into a Definition proposal ([R28](#r28)).**

- Signals and thresholds (tunable in the definition): 5 or more closed Findings of which a third are `wontfix`; 3 or more Findings that needed 2 or more `needs-info` rounds ([R7](#r7)); 2 or more Met overrides by the user ([R41](#r41)); 2 or more Consultations decided against the agent's recommendation ([R53](#r53)).
- A single `wontfix` reason or `needs-info` answer becomes a memory learning ([R18](#r18)). A crossed threshold becomes one Definition proposal; each pattern is reported once.
- The count runs in the first hourly sweep of each day (UTC); a fired session skips it, and every other sweep stays a quick exit ([R46](#r46)). The State issue body gets no track-record section.

*Why:* triage outcomes are the user's verdicts on the agent's judgement; counting them is how an unattended agent learns which Objectives it misreads, without a `/retro` session the user has to run. The agent proposes and the user decides, because the agent never edits its definition.
*Source:* [How do triage outcomes feed back into the definition?][32].

## 10. Goal review

The user implements a Goal agent's issues in their own sessions with the Engineering skills (`implement`, `code-review`, `pr`) and opens a PR. Before merging, the Goal agent checks the PR against the issues it closes and against its Goal: a Goal review. It starts without being asked: the gate fires the agent's routine ([R37](#r37)). `code-review` already checks the diff on two axes, coding standards and the originating spec; a Goal review leaves standards to it and judges the PR from the Goal agent's side: the issues it owns and its Goal.

Evidence for every rule in this section: in `ai-plugin-manager`, the user asked the main session by hand to spawn `plugin-maintainer` on PRs [#37][16], [#48][17], [#52][18], [#56][19], [#72][20], [#79][21] and [#100][22] (session transcripts). Every call improvised its prompt, write permissions changed from call to call (PR comment, follow-up issues and a state push in one; "report-only" in another, after which the user asked why state was not updated), the user had to ask whether the review had happened yet, re-review after fixes was requested each time, and the user, never the agent, merged and tagged.

<a id="r29"></a>
**R29. Require a Goal review for every PR whose closing references include an issue labelled `goal-agent:<name>`; that label names the reviewing agent.**

- A closing reference is one of GitHub's nine closing keywords (`close`, `closes`, `closed`, `fix`, `fixes`, `fixed`, `resolve`, `resolves`, `resolved`, matched case-insensitively) in the PR body followed by `#n` or `owner/repo#n`; the gate and the agent parse it by that one rule. An issue linked only from the PR sidebar, or a PR that only says `Part of #N` or `Refs #N`, is not gated; this is an accepted limitation.
- A PR closing issues of several Goal agents needs one Goal review from each.
- The State issue's label `goal-agent:state` (the reserved name, [R15](#r15)) is not a Goal agent name and never requires a Goal review. Agent names are limited to `[a-z0-9-]+`, so the marker can match them and the fire-token secret name maps back to one agent: it is `GOAL_AGENT_<NAME>_FIRE_TOKEN` with `<NAME>` the agent name uppercased and `-` turned into `_`, a mapping that cannot collide. The checklist in [R59](#r59) rejects any other name.
- Every other PR needs none.

*Why:* the scope label already says which agent owns an issue ([R10](#r10)), so the gate needs no new configuration. An unattended run cannot read GraphQL's `closingIssuesReferences`, so the gate and the agent share a rule both can apply over REST. A Goal agent has nothing to say about a PR outside its scope.
*Source:* Goal review design, approved by the user on 2026-10-15 ([ADR 0001][15], superseded by [ADR 0005][48]); [How does a Goal review start without being asked?][29] ([ADR 0003][46]); `ai-plugin-manager` PR reviews above.

<a id="r30"></a>
**R30. Retired: the user's session no longer spawns the agent for a Goal review; the gate fires the agent's routine and the hourly sweep is the backstop, see [R37](#r37), [R46](#r46) and [ADR 0005][48].**

<a id="r31"></a>
**R31. Start a Goal review like any session, through finding the State issue, then re-check the target and go straight to the PR; the closing issues, with their comments, are the review's spec.**

- Run the contract's start steps up to finding the State issue. Skip the rest: a pending `## Handoff`, `needs-info` answers, Deferred items and Progress wait for the hourly sweep, and there is no work loop and no sweep over the Objectives.
- The fire payload (the PR URL) is a hint. Re-check over REST that the PR is in a Covered repo, is not a draft, and is gated for this agent ([R29](#r29)); otherwise write nothing and end.
- Read the PR, its diff, its head SHA, and each closing issue with all its comments. The "Done when" criteria in the issue body bind the review; an Agent Brief comment is the spec of the request, a later comment overrides an earlier one, and advice comments (Consultation answers included) are context only.

*Why:* the review needs the contract and memory as much as any session, but acting on a handoff or sweeping sources would turn one review into a full session. The payload comes from a workflow and is untrusted text, so the agent verifies it. Triage's Agent Brief is the contract the implementer worked to ([R3](#r3)), so it is the yardstick; keeping "done when" in the body gives the review one place to read criteria from, which the user's sessions write after a Consultation ([R53](#r53)).
*Source:* Goal review design, approved by the user on 2026-10-15; [How does a Goal review start without being asked?][29] ([ADR 0003][46]); [How do the user's sessions consult the agent through issues?][30] ("Done when" in the body).

<a id="r32"></a>
**R32. Check three things, and not coding standards: (a) each closing issue's request and the "Done when" criteria in its body are met; (b) no drift from the Goal: the changes serve the Goal and its Objectives, stay within the closing issues' scope, and touch no Non-goal; (c) the agent-specific checks in the definition's `## Goal review` section.**

*Why:* (a) overlaps `code-review`'s Spec axis on purpose: the agent filed or owns the issue, so it reads the request as its reporter, with the issue's history. (b) needs the Goal, Objectives and Non-goals, which `code-review` never sees. Coding standards are `code-review`'s Standards axis; checking them twice would only produce conflicting findings. (c) keeps checks that only one agent needs out of the contract ([R25](#r25)).
*Source:* Goal review design, approved by the user on 2026-10-15; `skills/engineering/code-review/SKILL.md` (Standards and Spec axes); [How do the user's sessions consult the agent through issues?][30].

<a id="r33"></a>
**R33. Grade every finding: blocking when a closing issue's requirement or "done when" criterion is not met, when the PR drifts from the Goal or touches a Non-goal, or when it breaks an Objective (a Met one included); non-blocking otherwise. The verdict is `blocked` if and only if there is at least one blocking finding, else `pass`.**

*Why:* a fixed, short list of blocking grounds keeps the verdict predictable for the user and for the gate ([R37](#r37)); everything else is advice the user may take or leave. A Met Objective can become open again, so a PR may still break it ([R41](#r41)).
*Source:* Goal review design, approved by the user on 2026-10-15; [How does the agent measure progress on a cross-repo Goal?][34].

<a id="r34"></a>
**R34. Post exactly one PR comment per reviewed head SHA, through `gh api`. Right before posting, list the PR's comments again and post nothing if a Goal review marker for this SHA and agent already exists. The comment's first line is the Goal review marker, its second the AI marker ([R9](#r9)); then the verdict, the blocking findings, the non-blocking findings (with `file:line`), and the follow-up issues filed.**

```markdown
<!-- goal-agent-review:<name> sha=<40-hex head SHA> verdict=pass|blocked -->
> *This was generated by AI: <name> Goal agent.*

**Verdict: pass | blocked**

### Blocking
- <finding>, `path/to/file:line`. <Which issue requirement, Objective or Non-goal.>

### Non-blocking
- <finding>, `path/to/file:line`.

### Follow-ups filed
- owner/repo#<n> <title>
```

- A footer the routine appends below the comment (an unprompted Claude Code line) is tolerated; the gate reads only the first line.

*Why:* the marker is machine-readable, so the gate can verify that a review exists for exactly the commit being merged ([R37](#r37)); as an HTML comment it does not render, so readers see the AI marker first. The full 40-character SHA avoids prefix ambiguity. One comment per SHA keeps the PR timeline readable and the latest verdict unambiguous; the re-check before posting keeps a fire and the sweep from posting twice ([R49](#r49)).
*Source:* Goal review design, approved by the user on 2026-10-15 ([ADR 0001][15]); [How does a Goal review start without being asked?][29] ([ADR 0003][46]); [Can a gate workflow fire a routine that posts a Goal review comment?][35] (footer).

<a id="r35"></a>
**R35. During a Goal review, write only: the one PR comment, follow-up `needs-triage` Findings for findings outside the PR's scope (filed and deduplicated by the normal filing rules, [R2](#r2)–[R6](#r6) and [R39](#r39)), the State issue (`## Order` for the follow-ups), and memory ([R18](#r18)). Never approve, request changes, push to the PR branch, merge, or create tags or releases. The PR comment is the review's report; write no other.**

*Why:* in `ai-plugin-manager` the permissions changed per call, and a "report-only" review left state stale. A fixed write set makes every review behave the same. Approving, merging and tagging are the user's decisions; a push to the PR branch would make the agent an implementer and change the head SHA it just reviewed. Nobody waits for a report in an unattended run; the PR comment is where the user looks.
*Source:* Goal review design, approved by the user on 2026-10-15; `ai-plugin-manager` PR reviews above; [How does a Goal review start without being asked?][29] ([ADR 0003][46]).

<a id="r36"></a>
**R36. Review every new head SHA of a non-draft PR once, without being asked; skip drafts. A Goal review comment for the current head SHA stands for "already reviewed": report nothing more and end. Never loop review and fix until clean.**

*Why:* a new commit invalidates the old verdict, and the gate sets the status back to pending and fires the routine ([R37](#r37)), so no one has to ask for a re-review. A review-until-clean loop would put the agent in charge of when the PR is done, which is the user's call; the agent never pushes a fix anyway ([R35](#r35)).
*Source:* Goal review design, approved by the user on 2026-10-15; [How does a Goal review start without being asked?][29] ([ADR 0003][46]); `ai-plugin-manager` PR reviews above.

## 11. Goal review enforcement

Each Covered repo adopts this section, so that a missing Goal review blocks the merge and also starts the review. The goal-agent repo holds the tested source of the guard, gate and Consultation scripts and their tests; the Home repo setup steps copy them into each Home repo, pinned to a goal-agent commit or tag recorded in the definition's `goal-agent-pin` field, and the user installs each Covered repo's workflow as part of adding the repo ([R59](#r59), [ADR 0006][50]). The design here is the specification those scripts are tested against. The agent never writes the workflow or the branch protection. The Home repo has no gate: its `main` takes only the user's PRs and the agent's memory pushes, which the audit watches ([R50](#r50)). `ai-plugin-manager` has no gate today and none for `plugin-maintainer` until that agent migrates; the migration installs the full gate ([R61](#r61)).

<a id="r37"></a>
**R37. Enforce the Goal review with a gate workflow in each Covered repo that fires the agent's routine when a review is missing, checks for the marker comment, and sets the commit status `goal-agent-review` on the PR's head SHA, required by branch protection on `main` with enforcement for admins and with the GitHub Actions app as the expected source.**

The workflow, `.github/workflows/goal-agent-review.yml`:

- **Triggers:** `pull_request_target` (`opened`, `synchronize`, `reopened`, `edited`, `ready_for_review`), `issue_comment` (`created`, `edited`, `deleted`, only when the issue is a PR) and `issues` (`labeled`, `unlabeled`). `edited` catches a changed closing reference in the PR body; `synchronize` catches a new head SHA; `ready_for_review` starts the review of a former draft; a deleted comment can remove the review a `success` rested on; a label change on an issue that a PR closes can add or remove a gate, so the workflow then re-evaluates every open PR that closes that issue.
- **Trust:** use `pull_request_target`, never `pull_request`, and check out only the default branch (or nothing); run nothing from the PR. The workflow only reads the API and calls the fire endpoint.
- **Errors:** fail closed. On any script error, or when a fire is rejected (`400 routine_paused`, `429`, any other non-2xx), fail the run and post `state=error` for the head SHA rather than leave a previous status in place. A PR stays blocked while the agent is off.
- **Permissions:** `contents: read`, `pull-requests: read`, `issues: read`, `statuses: write`. Secrets: per agent, `GOAL_AGENT_<NAME>_FIRE_TOKEN` and the routine's trigger id.
- **Concurrency:** one group per PR and event kind; a comment or label event never cancels a `pull_request_target` run that may fire, since a lost fire leaves the review to the hourly sweep.
- **Logic:**
  1. Parse the closing references from the PR body ([R29](#r29)), read each closing issue's labels over REST, and collect the agent names from `goal-agent:<name>` labels.
  2. None: status `success`, "No goal-agent issue closed".
  3. Otherwise, for each agent, take the latest PR comment whose `author_association` is `OWNER`, `MEMBER` or `COLLABORATOR` and whose body starts with `<!-- goal-agent-review:<name> sha=<current head SHA>`.
  4. Every agent `pass`: `success`. Any `blocked`: `failure`. Any missing: `pending`.
  5. For a non-draft PR, fire the routine of each agent whose review is missing, once per head SHA and agent: `POST https://api.anthropic.com/v1/claude_code/routines/<trigger id>/fire` with `Authorization: Bearer <fire token>`, `anthropic-beta: experimental-cc-routine-2026-04-01`, `anthropic-version: 2023-06-01` and the body `{"text": "<PR URL>"}`. The pending status description records the agents already fired for this SHA, so a later event does not fire them again. A draft gets `pending` and no fire.
- **Report:** a commit status with context `goal-agent-review` on the head SHA, not a check run: a run triggered by `issue_comment` cannot attach a check run to the PR head. The agent's review comment triggers `issue_comment`, so the gate turns green or red about 30 seconds after the fire.
- **Branch protection** on `main`: required status contexts `goal-agent-review` plus the repo's own tests, and enforce for admins, otherwise `gh pr merge --admin` bypasses it. Set the expected source of `goal-agent-review` to the GitHub Actions app, so only statuses posted by the workflow's `GITHUB_TOKEN` count. Require the status context only, never the workflow job: the job is green even when the status is pending or failure. The user requires it after the gate's first run on a real PR ([R59](#r59)).

Limits the Covered repo accepts:

- `issue_comment` workflows run from the default branch, so the gate works only once the workflow is merged to `main`; the gate's own PR does not fire it.
- The status proves that a review was posted for this SHA by someone with write access, not that it was sound. The routine posts under the user's account ([R9](#r9)), so its comments pass the author check; a marker from anyone else is ignored.
- PRs that only say `Part of #N` or `Refs #N`, or link an issue only from the sidebar, are not gated ([R29](#r29)).
- A closing reference `owner/repo#n` to an issue in another Covered repo is read over REST, but a label change there does not trigger this repo's gate. The hourly sweep re-checks gate statuses that are still pending ([R46](#r46)), so the delay is at most one hour.
- PRs already open when the gate is installed get a status only on their next event, or a review from the hourly sweep.
- A routine takes at most 30 fires per hour, shared with "Run now" (the routine page's button), which counts as a manual sweep and goes through the same guard ([R45](#r45)); the account at most 100. A rejected fire fails the gate; the hourly sweep still reviews the PR, only later.
- The API trigger is a research-preview beta (`experimental-cc-routine-2026-04-01`); if it breaks, the hourly sweep reviews every PR, only later.

*Why:* without enforcement the review is forgotten; in `ai-plugin-manager` the user had to ask whether it had happened. The gate already runs on every event that can make a PR gated, so it is the one place that sees every PR, however it was opened; firing from it starts the review without anyone asking, and the hourly sweep covers a lost fire. Checking a marker is cheap and ties the verdict to the exact commit being merged. Without an expected source, anyone with write access, the Goal agent included through the user's `gh` login, could post `goal-agent-review=success` with a plain commit-status call, and enforcement for admins does not stop that; the source restriction does. `pull_request_target` runs the workflow file from the default branch, so a PR cannot edit the workflow and post success for itself, and fork PRs get a token that can write statuses. Rejected: a hook in the user's session (fires only for PRs opened from that session), a routine GitHub trigger (sees PR labels, not the closing issues' labels), and the hourly schedule alone (up to an hour pending).
*Source:* Goal review design, approved by the user on 2026-10-15 ([ADR 0001][15]); [How does a Goal review start without being asked?][29] ([ADR 0003][46]); [Can a gate workflow fire a routine that posts a Goal review comment?][35]; [Does a target named only in the fire payload count as user intent for the classifier?][39] (limits, concurrency); [Which safeguards bound an unattended agent?][33] (fail closed); [GitHub docs: commit statuses](https://docs.github.com/en/rest/commits/statuses), [protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

## 12. Running unattended

Every Goal agent runs without the user: no session of the user's runs it, and nothing waits for the user to open one ([ADR 0005][48]). This section is the shape of that run and what bounds it.

<a id="r44"></a>
**R44. Run every Goal agent as a single-repo cloud routine (`/schedule`) whose only source is its Home repo, with an hourly schedule and an API trigger. The agent reaches each Covered repo by calling the built-in `add_repo` tool for it (no clone) and then `gh api`. The routine prompt names the owner, the Covered repos and the writes the agent may make there, and tells the agent to read its definition and act as that agent.**

- [Appendix F](#appendix-f-routine-prompt) is the prompt. A fire's payload carries only the target URL; the prompt's wording covers the payload-less hourly sweep.
- All tracker work is `gh api` REST ([R23](#r23)); the agent works only from issues, PRs, diffs and files fetched by path, and never needs a local tree of a Covered repo.
- Environment constraints ([cloud environments](https://code.claude.com/docs/en/cloud-environments), [settings](https://code.claude.com/docs/en/settings)):
  - Node 22 is on `PATH`, and `git`, `gh` and `jq` are pre-installed.
  - The cloud GitHub proxy rejects GraphQL-based `gh` subcommands such as `gh issue` and `gh pr`. Every script that runs inside the routine reaches GitHub only through `gh api` with REST endpoints.
  - `curl` is not documented as pre-installed in the routine. Firing happens from GitHub Actions, where `curl` is available. If anything in the routine needs `curl`, the routine environment's setup script installs it.
  - Repo hooks load only in a session with one repository, which one Home repo per agent ([ADR 0005][48]) satisfies. User-level hooks do not run in the cloud.

*Why:* a cloud routine bills to the user's subscription, needs no machine, and starts fresh each time, so state lives in GitHub. GitHub Actions is one repo by default and a local scheduler needs the machine on. A multi-repo routine loads no repo hooks, which would leave every boundary in prose, so the routine is single-repo on the Home repo and attaches Covered repos itself. The auto-mode classifier passes a Covered repo write only when the user's own messages ask for it; `autoMode` settings, the routine's `auto_mode_*` fields and `permissions.allow` have no effect, so the prompt names the repos and writes, and a fire's payload arrives as a user message. Work that needs a whole tree is engineering work, which belongs to the user's sessions.
*Source:* [Where can a Goal agent run unattended across several repos?][24]; [Which routine shape runs the cross-repo Goal agent?][38] ([ADR 0004][47]); [Can a single-repo routine reach its Covered repos past the auto-mode classifier?][37]; [Does a target named only in the fire payload count as user intent for the classifier?][39]; [Should every Goal agent run in cross-repo mode?][44] ([ADR 0005][48]).

<a id="r45"></a>
**R45. Guard the routine, in cloud sessions only, with `SessionStart` and `PreToolUse` hooks in the Home repo's `.claude/settings.json`; the hook command runs the copy of the guard committed on `origin/main`, not the file on disk. The guard denies:**

- **the Skill tool;**
- **a `git push` that is not its own command or that touches anything outside `memory/`;**
- **`git clone` and `gh repo clone`;**
- **every non-GET `gh api` call and every GraphQL mutation, except under `repos/<owner>/<repo>/issues…` for the Home repo and the Covered repos;**
- **Edit, Write and NotebookEdit inside the Home repo outside `memory/`;**
- **every `mcp__` tool except `add_repo`;**
- **every tool while the agent is Halted, which the guard reads from the State issue once at `SessionStart`.**

- Scope: the guard applies only to cloud sessions, those where `CLAUDE_CODE_REMOTE` is exactly `"true"`. With any other value, or the variable unset, `SessionStart` does nothing (no GitHub call, no session record) and `PreToolUse` allows every tool without reading a record. The guard reads the variable at its entry point, and the hook command checks it first and exits 0 before extracting the guard from `origin/main`, so a local clone whose `origin/main` has no `scripts/` yet is never blocked. Claude Code sets it in cloud sessions only, hook processes inherit it, and the agent cannot change it for a hook from inside its session.

- A `SessionStart` hook cannot deny tools, so the guard hands its Halted verdict to `PreToolUse` through a session record: `SessionStart` writes it, keyed by session id, outside the repo tree, and every `PreToolUse` call reads it. If the record is missing or unreadable, `PreToolUse` denies the tool.

- The guard reads the Covered repo list from the definition's `## Covered repos` ([R42](#r42)).
- The guard matches shell text, so a `curl` with a token, a script or a rewritten local ref can still get past it. The auto-mode classifier and the Home repo audit ([R50](#r50)) are the backstops.
- The guard covers the agent's own repos only; staying out of another Goal agent's State issue and markers in a shared Covered repo is a contract rule ([R57](#r57)).

- Two consequences are accepted ([ADR 0007][51]). If Claude Code renames or drops `CLAUDE_CODE_REMOTE`, the routine runs unguarded; the Home repo audit ([R50](#r50)) and the auto-mode classifier are the backstops. The user's interactive web sessions on a Home repo are guarded like the routine, because no documented signal tells a routine session from an interactive cloud session.

*Why:* the agent runs unattended, so its limits have to be enforced, not requested ([R26](#r26)). The project hooks run in every session opened in a Home repo clone, and the user's own local sessions there must prepare the PRs that change the definition, the contract and the pinned scripts (§3), so the guard restricts the routine's cloud sessions and leaves local sessions alone. A cloud session never installs repo-enabled plugins, so plugin hooks do not run; Home repo project hooks do, in a single-repo routine. Reading the guard from `origin/main` keeps a shell redirect from rewriting it mid-session. The allowed write set is exactly what the contract lets the agent write: issues and comments (PR comments are issue comments in the API), and its memory.
*Source:* [Which routine shape runs the cross-repo Goal agent?][38] ([ADR 0004][47]); [Do plugin hooks enabled from the Home repo run in a multi-repo routine session?][36].

<a id="r46"></a>
**R46. Run three kinds of session, each starting with the same start steps ([Appendix B](#appendix-b-draft-docsagentsgoal-agentsmd-in-the-home-repo)):**

- **A fired Goal review**, payload a PR URL: one Goal review of that PR ([R31](#r31)), then end.
- **A fired Consultation answer**, payload a comment URL: answer that question ([R53](#r53)), then end.
- **The hourly sweep**, no payload: handoff, missing Goal reviews on gated PRs in every Covered repo, unanswered Consultations, `needs-info` answers, Deferred items whose trigger fired, Progress when work landed, the daily count ([R43](#r43)) in the first sweep of the day, then the definition's work loop. A sweep that finds nothing new writes only its `Last run` comment and ends (quick exit).

*Why:* one job per fired run keeps each fire short and its cost predictable. The sweep is the backstop for every lost or rejected fire and the place for the agent's own work toward its Goal; making it a quick exit when nothing changed keeps 24 runs a day cheap.
*Source:* [How does a Goal review start without being asked?][29] ([ADR 0003][46]); [How do the user's sessions consult the agent through issues?][30]; [Which safeguards bound an unattended agent?][33].

<a id="r47"></a>
**R47. When a session cannot go on, stop and report: post a marked comment on the State issue saying what blocked it, then end the session. If the State issue itself cannot be found, open one issue in the Home repo instead. Report a recurring blocker once: if the latest blocker comment names the same blocker and nobody has replied since, post nothing; never open a second fallback issue while one is open.**

- Every "stop and ask" in the first design is "stop and report": a missing contract ([R27](#r27)), missing memory ([R18](#r18)), more than one State issue ([R15](#r15)), a missing label or triage docs in a Covered repo ([R39](#r39)), a Covered repo list mismatch ([R42](#r42)), an Objective without a criterion ([R41](#r41)).
- The agent never sets Halted for its own blockers ([R48](#r48)).

*Why:* nobody is at the session to answer a question, and a reply in the session would be lost with it. The State issue is where the user looks for the agent, and reporting a blocker once keeps 24 runs a day from flooding it.
*Source:* [What changes in the contract when nobody is at the session?][28]; [Which safeguards bound an unattended agent?][33].

<a id="r48"></a>
**R48. Set no token, cost or issue caps; bound spend by run shape. Stop the agent with the routine's on/off switch, or in-band by making it Halted.**

- Spend is bounded by one job per fired run, the quick-exit hourly sweep, the 30 fires per hour per routine, and the subscription window with usage credits off.
- Hard switch: the routine's on/off switch stops scheduled runs; a paused routine rejects fires, and the gate fails closed ([R37](#r37)).
- In-band: the agent is Halted while its State issue carries the halt marker. The user or the Home repo audit ([R50](#r50)) sets it; only the user clears it; the agent never sets it. The guard reads it at `SessionStart`, records the verdict for `PreToolUse`, which denies every tool ([R45](#r45)), so a Halted session ends at once without writing. The marker's exact form is left to the spec; it must survive the agent's body writes ([R15](#r15)).

*Why:* caps would either be too loose to matter or stop useful work at an arbitrary count; one job per fire and a cheap sweep keep spend proportional to activity. The switch stops runs; Halted also covers a run already started and lets the audit stop the agent without the user.
*Source:* [Which safeguards bound an unattended agent?][33]; [Does a target named only in the fire payload count as user intent for the classifier?][39] (paused routine refuses fires).

<a id="r49"></a>
**R49. Make every write idempotent instead of taking a lock: re-list before posting a Goal review ([R34](#r34)) or a Consultation answer, re-read before every State issue body write ([R15](#r15)), and rebase a non-fast-forward memory push and retry it once ([R18](#r18)).**

*Why:* a fire and the sweep can overlap, and a classifier denial can make a write fail at random; an idempotent write lets the next run retry safely, and nothing has to hold or release a lock in a run that may die.
*Source:* [Which safeguards bound an unattended agent?][33]; [Which routine shape runs the cross-repo Goal agent?][38] (classifier retries).

<a id="r50"></a>
**R50. Audit the Home repo: a workflow on every push to `main` sets Halted and opens one issue for any commit that touches anything outside `memory/` and did not arrive through a merged PR (`GET /repos/<owner>/<repo>/commits/<sha>/pulls`). Nothing is reverted.**

- The user changes the definition, contract, workflows and hooks only through PRs. Covered repos have no audit: their gate still stands between a stray push and `main`.

*Why:* the guard matches shell text and can be bypassed ([R45](#r45)); the audit catches the result after the fact. Keying on merged PRs rather than the `Goal-agent:` trailer tells the user's changes from the agent's, which share one account.
*Source:* [Which routine shape runs the cross-repo Goal agent?][38] ([ADR 0004][47]), amending [Which safeguards bound an unattended agent?][33].

<a id="r51"></a>
**R51. Keep one marked `Last run` comment on the State issue, edited in place by every session that is not Halted: time, issues filed, comments posted, quick exit yes or no. A daily scheduled workflow in the Home repo opens one issue when that comment is older than 6 hours, unless the agent is Halted.**

*Why:* an unattended agent that silently stops running looks the same as one with nothing to do. A comment rather than a body line keeps a write every hour out of the co-edited body ([R15](#r15)).
*Source:* [Which safeguards bound an unattended agent?][33]; [Where are findings filed, and how is one Order kept across repos?][27] (comment, not body).

## 13. Consultation

The user's sessions never run a Goal agent. When a decision on an issue in the agent's scope depends on the Goal, the session asks the agent in a comment on that issue, and the agent answers there: a Consultation. The user decides.

<a id="r52"></a>
**R52. Consult the agent before deciding an in-scope issue's scope, its Objective, its place in the Order or its "done when" criteria, and at no other point.**

- `/triage` on any issue in a Covered repo first asks whether it belongs to the Goal; the answer decides whether `goal-agent:<name>` goes on ([R10](#r10)).
- On labelled issues, `/triage`, grilling, `/to-spec` and `/to-tickets` consult only before one of those four decisions; `/wayfinder` charting consults on the Destination ([R40](#r40)). Don't consult when the issue already holds the agent's answer to the same question.
- Only the "Done when" criteria in the issue body bind the Goal review ([R31](#r31)). The agent may propose Goal-derived criteria (advances Objective X, touches no Non-goal Y); the session writes the accepted ones into the body.

*Why:* these four decisions are where the Goal matters and where the agent knows more than the session: its Objectives, its Order and its Non-goals. Consulting anywhere else would slow the user's sessions for no gain.
*Source:* [How do the user's sessions consult the agent through issues?][30]; [Where do wayfinder maps in Covered repos sit in the Order?][31].

<a id="r53"></a>
**R53. Ask in one marked comment on the issue the skill started from, in its Covered repo, opening with `> *Question for <name> Goal agent.*`; one comment may hold several numbered questions. The agent answers on the same issue with its AI marker ([R9](#r9)), naming the question it answers. It only recommends: it never decides, never touches labels and files nothing.**

- Only a question from an author whose association is `OWNER`, `MEMBER` or `COLLABORATOR` gets an answer.
- Before answering, the agent lists the issue's comments again and answers nothing already answered ([R49](#r49)).

*Why:* the user's standing preference is that the user, the user's sessions and the agent talk through GitHub issues, not in-session replies. The question lives with the issue it decides, so the answer stays as context for triage, the spec and the Goal review. A recommendation keeps the decision with the user.
*Source:* [How do the user's sessions consult the agent through issues?][30].

<a id="r54"></a>
**R54. A `.github/workflows/goal-agent-consult.yml` workflow in each Covered repo runs on `issue_comment` and, for a comment from an `OWNER`, `MEMBER` or `COLLABORATOR` that opens with the question marker, fires the named agent's routine with the comment URL. The hourly sweep answers any question still unanswered.**

*Why:* the answer has to start without anyone asking, as a Goal review does; the gate's fire mechanism ([R37](#r37)) works for comments too, with the same secrets. A fired answer takes from about 30 seconds to a few minutes; the sweep covers a lost fire.
*Source:* [How do the user's sessions consult the agent through issues?][30]; [Does a target named only in the fire payload count as user intent for the classifier?][39].

<a id="r55"></a>
**R55. While waiting, the session parks that one decision and goes on with the others; a background Monitor (a shell until-loop, no tokens) watches the issue for the answer, with a timeout of about 20 minutes. On timeout the user decides alone, and the session notes on the issue that the decision was made without the agent's advice; a late answer stays as context.**

*Why:* a Consultation takes from 30 seconds to an hour in the worst case; blocking the session on it would waste the user's time, and a timeout keeps the agent from ever holding a decision hostage.
*Source:* [How do the user's sessions consult the agent through issues?][30]; [ADR 0005][48] (latency).

<a id="r56"></a>
**R56. Put the Consultation rule inline in a `### Goal agents` block under `## Agent skills` in each Covered repo's CLAUDE.md: each agent's name, Home repo and label, when to consult ([R52](#r52)), how to ask ([R53](#r53)), how to wait ([R55](#r55)), when not to consult, and that issues created by `/to-spec` or `/to-tickets` inherit their parent's `goal-agent:<name>` label (the session adds it). This document owns the canonical text ([Appendix E](#appendix-e-covered-repo-files)).**

*Why:* the user's sessions in a Covered repo load its CLAUDE.md, and the Home repo is not on disk there, so the rule must be inline. The skills stay unchanged; the session follows the rule. The agent never writes CLAUDE.md ([R21](#r21)); installing the block is part of adding a Covered repo ([R59](#r59)).
*Source:* [How do the user's sessions consult the agent through issues?][30]; [How does a cross-repo Goal agent coexist with a single-repo Goal agent in the same repo?][40] (one block).

## 14. Several Goal agents on one Covered repo

<a id="r57"></a>
**R57. Let several Goal agents cover one repo. Their Orders stay independent, the gate waits for each, and each agent keeps out of the other's state.**

- One `### Goal agents` block in CLAUDE.md and one registry in `docs/agents/goal-agents.md` list them all, each with its Home repo ([R56](#r56), [R22](#r22)). `/triage` asks the Goal-fit question for each listed agent.
- Agent names are unique per Covered repo; the user checks this when adding a repo ([R59](#r59)).
- An issue may carry both labels. Each agent keeps it in its own Order; the gate fires each agent's routine and waits for both markers ([R37](#r37)).
- Findings deduplicate against every open issue through a marked comment, never a label change ([R39](#r39)).
- An agent never writes another agent's State issue, never posts a Goal review marker or Consultation answer under another name, and never edits another agent's comments. This is a contract rule, not guard-enforced; read-only monitoring of another agent is allowed.

*Why:* two Goals can share a repo without either owning it; independent Orders keep each recommendation intact, and labels already say which agent owns an issue. The gate's union of labels needs no change for two agents.
*Source:* [How does a cross-repo Goal agent coexist with a single-repo Goal agent in the same repo?][40], as narrowed by [Should every Goal agent run in cross-repo mode?][44] (every agent gate-fired, every registry row has a Home repo).

## 15. Covered repos and the routing guide

<a id="r58"></a>
**R58. Brief Goal agents in the routing guide [`docs/routing-new-ideas.md`][49] through Consultation only. The guide is edited at implementation, after `/to-spec`, not on its PR.**

- §1 entry point "Consult the Goal agent": always a Consultation on the issue; the session finds the agent in the Covered repo's `### Goal agents` block.
- One source for the comment: the guide holds the "Ask / Do not ask" table and links to the `### Goal agents` block for how to post and wait ([R56](#r56)).
- §2 C ("Assess"): file the idea as an issue in the Covered repo where the change lands first, label it `goal-agent:<name>`, and post a Consultation with the scope and Objective question. If the agent recommends against it and the user agrees, the label comes off. Nothing goes to the State issue.
- No async path: `needs-info` is only for questions to the issue's author.
- The guide names the skills that consult: `/triage`, grilling, `/to-spec`, `/to-tickets`, `/wayfinder`.
- Situation E: a labelled Map's place passes to the spec at `/to-spec` ([R40](#r40)).
- §3's note that the mechanism was not tried in a trial run no longer holds: it was tested end to end.

*Why:* the guide is where a new idea first meets the Goal; with one mode there is one way to ask, so the guide needs no mode switch and no in-session branch.
*Source:* [How does the routing guide brief a cross-repo Goal agent?][42], as narrowed by [Should every Goal agent run in cross-repo mode?][44] (in-session branch dropped); [Where do wayfinder maps in Covered repos sit in the Order?][31]; [Does a target named only in the fire payload count as user intent for the classifier?][39].

<a id="r59"></a>
**R59. Add or remove a Covered repo, and retire a Goal agent, by the checklists below. The user works through them, or the user's session on request; the agent does none of the steps.**

Adding a Covered repo (it is covered once the Home repo PR is merged):

1. Prerequisites in the Covered repo: check that the agent's name matches `[a-z0-9-]+` (reject any other) and differs from every Goal agent already registered there ([R57](#r57)); create the label `goal-agent:<name>`; confirm the triage docs (`docs/agents/triage-labels.md`) exist; install the Claude GitHub App; set the secrets `GOAL_AGENT_<NAME>_FIRE_TOKEN` and `GOAL_AGENT_<NAME>_TRIGGER_ID` (the routine's trigger id). If the label or triage docs are missing later, the agent stops and reports ([R39](#r39)).
2. Home repo PR: add the repo to the definition's `## Covered repos`, with any Objective or "Met when" changes in the same PR. Then edit the routine prompt the same day ([R42](#r42)).
3. Covered repo PR: the gate and Consultation workflows ([R37](#r37), [R54](#r54)) together with the scripts they run (copy `scripts/gate/*.mjs` from goal-agent to `.github/scripts/goal-agent-review/`, at the same pin as the Home repo; the workflows run that copy). Both workflows pass the whole `secrets` object to one step as `GOAL_AGENT_SECRETS`, because an expression cannot upper-case an agent name, so that step can read every secret of the repo. Nothing from the PR is executed there, which keeps the risk low, but keep the repo's secrets to those it needs. Also add the agent in the `### Goal agents` block of CLAUDE.md (a new block if there is none), and the agent's row with its Home repo in `docs/agents/goal-agents.md` ([Appendix E](#appendix-e-covered-repo-files)). The gate's own PR does not fire it.
4. After the gate's first run on a real PR, make `goal-agent-review` a required status ([R37](#r37)).

Removing a Covered repo:

1. Remove `goal-agent-review` from the required statuses, so open PRs are not left blocked.
2. Covered repo PR: remove both workflows, the agent from the `### Goal agents` block and its registry row.
3. Answer or withdraw any pending Consultation there.
4. Home repo PR: remove the repo from `## Covered repos`, and rewrite or delete any Objective or "Met when" that names it. Then edit the routine prompt. The definition change makes the agent re-judge every Objective ([R41](#r41)); it drops the repo's Order entries with a marked comment ([R13](#r13)).
5. Delete the fire-token secret, the trigger id and the label. Open Findings stay as ordinary issues under that repo's triage; the agent writes nothing more to them. The Claude GitHub App stays.

Retiring a Goal agent:

1. Run the removal checklist for every Covered repo.
2. Disable the routine.
3. Close the State issue with a marked comment.
4. Archive the Home repo.

*Why:* every step touches the user's configuration (labels, secrets, CLAUDE.md, workflows, branch protection), which the agent never writes ([R21](#r21)); a checklist is enough, and a setup script is out of scope. Requiring the gate last, and unrequiring it first, keeps a half-installed gate from blocking merges.
*Source:* [What does adding or removing a Covered repo involve?][43]; [How does a Goal review start without being asked?][29] ([ADR 0003][46], secrets and App).

## 16. Pilot and migration

<a id="r60"></a>
**R60. Pilot the design with one Goal agent on real work: `goal-steward`, Home repo `hsmejky/goal-steward-home` (private), covering `hsmejky/ai-plugin-manager` and `hsmejky/goal-agent`. A synthetic smoke run may be one acceptance step.**

- Goal: "Goal agents in hsmejky's repos run correctly and usefully on current Claude Code, and their design, contract and docs stay consistent and improve from evidence."
- Objectives, ranked:
  1. **Health.** Every Goal agent registered in a Covered repo keeps up. *Met when* its latest `Last run` is within its cadence and no stop-and-report blocker older than 7 days lacks an issue. `goal-steward` does not monitor itself; its own staleness check covers that ([R51](#r51)).
  2. **Platform fit.** *Met when* every Claude Code release since the last Checkpoint has been checked against the features the contract relies on, and each break has an open issue.
  3. **Consistency.** *Met when* the design documents in `goal-agent`, the contract and docs in `ai-plugin-manager`, and the glossary agree.
  4. **Improvement from evidence.** *Met when* each pattern above the [R43](#r43) thresholds has a Finding or a Definition proposal.
- Non-goals: the parts of `ai-plugin-manager` that are not about Goal agents, Codex, `l1-trader`, `winvet-exporter`.
- Monitoring other agents is read-only ([R57](#r57)): it files Findings and never acts on them. It may file Findings against the contract it obeys; changes to its own definition go only as Definition proposals ([R28](#r28)).

*Why:* the mechanics are proven by the routine tests; the pilot tests whether the agent's judgement is useful, which only real work shows. A Goal about Goal agents exercises every part of the design on the repos that define it.
*Source:* [Which repos and Goal does the pilot cross-repo Goal agent cover?][41], as narrowed by [Should every Goal agent run in cross-repo mode?][44] (Checkpoint lag for session-run agents dropped from Health).

<a id="r61"></a>
**R61. After the `goal-steward` pilot, move `plugin-maintainer` in `hsmejky/ai-plugin-manager`, the last session-run Goal agent, to its own Home repo by the checklist below. Its definition, memory and State issue move to the Home repo; its open Findings stay as issues in `ai-plugin-manager`.**

1. Prerequisite: the pilot is accepted, and the contract and appendices of this document are adopted in `goal-steward-home`.
2. Create the Home repo (for example `hsmejky/plugin-maintainer-home`), set up like any repo with the Engineering skills ([R38](#r38)).
3. Home repo PR: the definition, rewritten from `ai-plugin-manager`'s `.claude/agents/plugin-maintainer.md` to [Appendix A](#appendix-a-definition-skeleton) (`## Covered repos` with `- hsmejky/ai-plugin-manager`, a "Met when" per Objective); `docs/agents/goal-agents.md` with the contract ([Appendix B](#appendix-b-draft-docsagentsgoal-agentsmd-in-the-home-repo)); the Goal agent operations section ([Appendix C](#appendix-c-docsagentsissue-trackermd--goal-agent-operations-in-the-home-repo)); CLAUDE.md; the guard hooks ([R45](#r45)) and the pinned copies of the guard, gate and Consultation scripts, with the definition's `goal-agent-pin` set to their goal-agent tag or commit ([ADR 0006][50]); the audit and staleness workflows ([R50](#r50), [R51](#r51)).
4. Memory: copy `.claude/agent-memory/plugin-maintainer/` into the Home repo's `memory/`; move any fact about `ai-plugin-manager` itself out of memory into the definition or that repo's docs ([R18](#r18)).
5. State issue: create it in the Home repo with `## Order` rewritten to `hsmejky/ai-plugin-manager#n` entries ([R13](#r13)), the Deferred items with their target repo, the Checkpoints as they stand, and `## Progress`; close the old State issue in `ai-plugin-manager` with a comment linking the new one.
6. Open Findings stay in `ai-plugin-manager` with their `goal-agent:plugin-maintainer` label and triage state; nothing is moved or relabelled.
7. Create the routine ([R44](#r44), [Appendix F](#appendix-f-routine-prompt)), disabled for now, and set its fire token and trigger id as secrets in `ai-plugin-manager`; check the Claude GitHub App is installed there.
8. `ai-plugin-manager` PR: install the gate, `goal-agent-review.yml`, that fires the routine ([R37](#r37)); the repo has only `offline-tests.yml` and the [ADR 0001][15] marker check was never installed, so there is nothing to switch from; add `goal-agent-consult.yml` ([R54](#r54)); put `plugin-maintainer` in the `### Goal agents` block with the inline Consultation rule ([R56](#r56)); reduce `docs/agents/goal-agents.md` to the registry, with the Home repo in the agent's row ([R22](#r22)); remove the Goal agent operations section from `docs/agents/issue-tracker.md`, `.claude/agents/plugin-maintainer.md`, `.claude/agent-memory/plugin-maintainer/` and any `/goal-review` skill.
9. Enable the routine once that PR is merged. Check the first `Last run` comment, and that the next gated PR gets its Goal review from a fire. `goal-agent-review` stays (or becomes) a required status ([R59](#r59) step 4).

*Why:* moving one live agent before the design has run once would risk the agent the user relies on most; after the pilot, the same steps that add a Covered repo move it. Findings belong to the repo they concern ([R39](#r39)), so only the agent's own files and state move.
*Source:* [Should every Goal agent run in cross-repo mode?][44] ([ADR 0005][48]); [What does adding or removing a Covered repo involve?][43].

## 17. Trial run

These recommendations were complete without a trial; three points were deferred until a trial run showed whether they are needed. One full `plugin-maintainer` session in `ai-plugin-manager` ran on 2026-10-14 with Claude Code 2.1.300, plus short runs for the memory check ([trial results][14]). It settled the first two points and half of the third. One session is a small sample, so each fallback stays recorded for a later session that shows the problem. One research recommendation still has no decision. The Goal review ([sections 10](#10-goal-review) and [11](#11-goal-review-enforcement)) was designed after the trial and has not been trialled.

The trial ran a session-run agent, before the one-mode design. Two of its points are superseded: the guard now enforces the file boundary ([R26](#r26), [R45](#r45)), and memory is plain files in the Home repo, checked at session start ([R18](#r18)). The routine mechanics were tested separately: a gate fires a routine that posts a Goal review ([#41][35]), Home repo hooks guard a single-repo routine ([#43][36]), `add_repo` reaches Covered repos ([#45][37]), and a fire's payload counts as user intent (16/16, [#47][39]). The pilot ([R60](#r60)) is the first trial of the whole design.

| Point | Decision after the trial | Trial evidence | Still open | If a later session shows a problem |
|---|---|---|---|---|
| Preloading the contract | Doc plus read gate, no preload ([R22](#r22), [R27](#r27)) | The one new issue carried the marker, the `needs-triage` and `goal-agent:<name>` labels, the four-section report template and an Objective in `## Why it matters`; no `ready-for-agent`. The session posted no comments. | Comments: none were posted, so their marker is untested. | Package the contract as a skill preloaded through `skills:`, cut along the section boundary (contract becomes the skill, registry stays in the doc). Mind that the skill then stays model-invocable in the main session unless restricted, an unresolved name is skipped silently, and `disable-model-invocation: true` blocks preloading ([What does a subagent's skills: frontmatter load, and when?][11]). |
| Commit hook | Superseded: the Home repo guard denies the Skill tool and any push outside `memory/` ([R45](#r45)) | One commit, touching only `.claude/agent-memory/<name>/`, with the `Goal-agent:` trailer. Every `Write` call targeted that directory; `Bash` wrote only temporary files. No Skill tool call. The State issue's `## Order` changed only by insertion. | None. | None; the guard is the hook. |
| Memory sentinel | Superseded: memory is plain files in the Home repo, and a missing or unreadable `memory/` stops the session ([R18](#r18)) | With `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` in the session's environment, the session reported memory off and stopped; with `0`, it continued. | Whether learnings survive to the next session: the pilot will show it. | Add a first-run sentinel line in memory; later sessions stop if it is missing. |
| Two-track thinking and the no-workarounds rule | None. [What do chief-of-staff and claude-handoff do, and how do they overlap with a Goal agent?][4] recommended adopting chief-of-staff's two-track thinking (tactical work plus "improve the environment for the next task", recorded as issues) and its no-workarounds rule, but no decision ticket placed them in the contract. | Not checked by the trial. | Whether sessions miss environment improvements or work around conventions instead of filing them. | Decide whether they belong in the Goal agent contract, then add them to `goal-agents.md`. |

## Appendix A: Definition skeleton

A starting point for `.claude/agents/<name>.md` in the Home repo. Angle brackets are placeholders. Frontmatter is kept for readers and tools; the routine does not enforce it, the guard does ([R26](#r26)).

```markdown
---
name: <name>
goal-agent-pin: <goal-agent tag or commit the copied guard, gate and Consultation
  scripts came from; written by the Home repo setup steps>
description: >
  Goal agent that owns <long-term goal> across its Covered repos. Finds <kinds
  of findings> in <watched sources> and files each one through triage; runs
  Goal reviews and answers Consultations. Runs only as its routine.
---

You are the <name> Goal agent. You run unattended, in many short sessions;
continuity lives in your State issue, the trackers and your memory, never in
conversation.

**Read `docs/agents/goal-agents.md` first, every session, and follow its
Goal agent contract. If you cannot read it, stop and report.**

## Goal

<One paragraph: the state of the world this agent keeps true.>

## Objectives (ranked; rank is the default rule for the Order)

1. **<Objective 1>.** <What must stay true.> Sources: <source A>.
   *Met when* <criterion>.
2. **<Objective 2>.** <...> Sources: <source B>. *Met when* <criterion>.

## Non-goals

- <What this agent deliberately does not pursue; a PR that touches one is
  blocked in a Goal review.>

## Covered repos

The guard reads this list; the routine prompt names the same repos.

- <owner>/<repo>

## Watched sources

| Source | Why watched | Checkpoint key |
|---|---|---|
| <url or path> | <one line> | `<key>` |

To change this definition, post a Definition proposal on your State issue;
the user edits it.

## Hard limits (only the user changes these)

- Shared filing rules and never-write list: `docs/agents/goal-agents.md`
  § Goal agent contract.
- <Agent-specific limit.>

## Session steps

The generic lifecycle is in `docs/agents/goal-agents.md` § Goal agent contract.
Agent-specific steps:

- Start, after the generic steps: <extra step, if any>.
- Work loop (hourly sweep only): <e.g. open Objectives in rank order; for each,
  process its sources from the Checkpoint on>.
- Signal thresholds, if not the defaults: <...>.
- A session is done when <"done" rule>.
- End, after the generic steps: <extra step, if any>.

## Goal review

The generic Goal review session is in `docs/agents/goal-agents.md`
§ Goal agent contract. Agent-specific checks, on top of the closing issues
and the Goal:

- <Check, e.g. "every changed <artifact> still matches <watched source>".>
```

## Appendix B: Draft `docs/agents/goal-agents.md` in the Home repo

A draft the user adopts, edits and commits in the Home repo; the agent never writes this file. Link it from the `## Agent skills` block in the Home repo's CLAUDE.md, for example:

```markdown
### Goal agents

The Goal agent contract for this Home repo's agent: see `docs/agents/goal-agents.md`.
```

The file:

````markdown
# Goal agents

## Goal agent contract

The Goal agent of this Home repo follows these rules. Tracker calls are in
`docs/agents/issue-tracker.md` § Goal agent operations. Your Covered repos are
in your definition's `## Covered repos`.

### Never write

- In no repo write `docs/agents/*`, `GLOSSARY.md`, `docs/adr/`,
  `.out-of-scope/`, CLAUDE.md or workflows. A term or decision you want
  recorded is an ordinary `enhancement` issue ("add glossary entry X",
  "record ADR Y").
- Never write your definition; propose changes as a Definition proposal.
- Never create a label. Never edit text you did not write. Never move an Order
  entry or revert the user's reordering.
- Never write another Goal agent's State issue, post a marker or answer under
  its name, or edit its comments.
- Your only repository write is `memory/` in this Home repo: committed alone,
  pushed directly to `main` in its own command, at most once per session, only
  when it changed, with the trailer `Goal-agent: <name>`. On a non-fast-forward
  push, rebase and retry once.
- Memory holds only learnings about how you do your job, true across the Goal.
  It never names a Covered repo. A domain term or a decision becomes an issue,
  never a memory entry.

### Stop and report

When you cannot go on, post a marked comment on your State issue saying what
blocked you, then end the session. If the State issue cannot be found, open one
issue in this Home repo instead. Report a recurring blocker once: if the latest
blocker comment names it and nobody replied, post nothing; never open a second
fallback issue while one is open. Never set the halt marker.

### Marking

- Every issue body and every comment you post starts with
  `> *This was generated by AI: <name> Goal agent.*`
  The State issue body carries no marker; your comments on it do. A Goal
  review comment opens with the Goal review marker, then this one.
- Every issue you file carries `needs-triage` (the only state label you ever
  apply), exactly one of `bug` / `enhancement` (your best guess; every finding
  that is not a defect is `enhancement`), and `goal-agent:<name>`.
- `goal-agent:<name>` marks your scope; the user also applies it to their
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

When the finding won't fit one fresh context window, isn't verifiable on its
own, or needs work in more than one Covered repo, end Suggested outcome with
this sentence, and omit it when unsure:
`Spec-sized: needs a spec and slices before implementation.`
No Spec-sized label, no `Spec:` title prefix.

### State issue

One, in this Home repo, labelled `goal-agent:state`, its title naming you.
Body sections:

- `## Order`: ordered list of every open issue labelled `goal-agent:<name>` in
  every Covered repo, as `owner/repo#n`, including specs that superseded one of
  them and labelled Maps (the user labels both). Slices and Map tickets never
  enter.
- `## Deferred items`: each with its trigger and target repo.
- `## Checkpoints`: one entry per watched source, by its Checkpoint key.
- `## Progress`: one line per Objective in rank order,
  `<n>. <Objective> — met | open — judged <time> — <evidence>`; never overwrite
  `met (set by user)` or `open (set by user)`.
- `## Handoff`: only while a note is pending.

Write the body only when one of these changes: read, compute, re-read; if
`updated_at` moved, re-apply your change to the fresh body; write, re-read to
verify, retry once. Keep the halt marker. Prune closed issues; insert new ones
where you recommend; never move an existing entry. A closed issue
"Superseded by <spec>" is replaced by the spec in the same slot; a transferred
issue is rewritten in its slot if its new repo is covered, else removed with a
marked comment. Judge "blocked" from `dependencies/blocked_by` and each
blocker's state. Suggest a reorder, post a Definition proposal or a concern
about the Goal, and report a verdict change, each in a marked comment on the
State issue. Keep one marked `Last run` comment there, edited in place every
session: time, issues filed, comments posted, quick exit yes or no.

### Session

Start (every session):

1. Read this file, `docs/agents/issue-tracker.md` and your definition.
2. Read `memory/`. Missing or unreadable: stop and report.
3. Compare your definition's `## Covered repos` with the repos the routine
   prompt names. Mismatch: report it once; work only on the intersection.
4. Call `add_repo` for each Covered repo you will work in.
5. Find your State issue. None: create it. More than one: stop and report.
6. A fire payload is a PR URL: run the Goal review session below, then end.
   It is a comment URL: run the Consultation session below, then end.

Hourly sweep (no payload), after Start:

1. `## Handoff` present: read it, act on it, delete it.
2. Query tracker facts fresh (open issues in scope, labels, blocking edges);
   never copy them into state.
3. Every non-draft PR in a Covered repo whose body closes an issue labelled
   `goal-agent:<name>` and that has no Goal review marker of yours for its head
   SHA: run the Goal review session for it.
4. Every question comment for you without your answer: run the Consultation
   session for it.
5. Answer open `needs-info` questions on issues you filed, as marked comments;
   touch no labels.
6. Deferred items whose trigger has fired: file them now and remove them from
   `## Deferred items`.
7. A `goal-agent:<name>` issue closed, a PR merged in a Covered repo, or your
   definition changed since the last measurement: re-judge every Objective into
   `## Progress`. All Objectives Met for the first time: post one
   "Goal reached" comment; file no more Findings.
8. First hourly sweep of the day (UTC; a fired session skips this): count the signals in your definition
   (defaults: 5+ closed Findings with a third `wontfix`; 3+ Findings with 2+
   `needs-info` rounds; 2+ Met overrides; 2+ Consultations decided against
   you). A single reason or answer: a memory learning. A crossed threshold: one
   Definition proposal, reported once.
9. Run your definition's work loop for the open Objectives only.
10. Nothing new in steps 1–9: edit `Last run` and end (quick exit).

Filing a Finding:

1. Pick the one Covered repo it concerns; spanning repos, the one where the
   change lands first. A concern about the Goal or your definition: a marked
   comment on the State issue, never an issue. Read that repo's
   `docs/agents/triage-labels.md` and `GLOSSARY.md`; label or triage docs
   missing: stop and report.
2. Search all issues, open and closed, in every Covered repo for the same
   finding. An open issue already covers it, whoever filed it: a marked comment
   naming the Objective, and file nothing; never change its labels.
3. Read that repo's relevant ADRs and `.out-of-scope/`. A match of a past
   rejection: don't file, unless there is new evidence; then file a
   `needs-triage` issue linking the rejection entry and stating what changed.
4. Not actionable until a named external trigger fires: a Deferred item, not an
   issue.
5. Otherwise one finding, one flat issue, with the template above. Never a spec,
   never slices, never split a finding to get under the Spec-sized threshold.
6. Blocking edges only between your own flat issues; never sub-issue links or
   edges on a spec or its slices. A finding touching an in-flight spec is a flat
   issue naming the spec in Evidence.
7. Insert the new issue into `## Order` where you recommend it.

Closing: close your own issue only while it is still `needs-triage`, with a
marked comment saying why. After triage, only comment.

End:

1. Update `## Checkpoints` for every source you processed.
2. Update `## Order` as above.
3. Commit and push memory if it changed.
4. Edit `Last run`.
5. Only when stopping mid-flow: write `## Handoff` (goal, state, next step,
   links). This overrides any instruction to write a handoff file to a
   scratchpad.

### Goal review session

A PR whose body closes (one of GitHub's nine closing keywords: close, closes, closed, fix, fixes,
fixed, resolve, resolves, resolved, followed by `#n` or `owner/repo#n`) an issue labelled `goal-agent:<name>` needs a Goal review by
that agent before merge. `Part of #N`, `Refs #N` and sidebar links do not count.

1. Re-check over REST: the PR is in a Covered repo, not a draft, and gated for
   you. Otherwise write nothing and end. Leave `## Handoff`, `needs-info`
   answers, Deferred items and Progress to the hourly sweep; no work loop.
2. Read the PR, its diff and its head SHA, and each closing issue with all its
   comments. The "Done when" criteria in the issue body bind; an Agent Brief
   comment is the spec of the request; a later comment overrides an earlier
   one; advice comments are context only.
3. If a Goal review comment of yours for this head SHA exists, end.
4. Check: (a) each closing issue's request and the "Done when" criteria in its
   body are met; (b) no drift from your Goal: the changes serve the Goal and
   its Objectives, stay within the closing issues' scope, and touch no
   Non-goal; (c) the checks in your definition's `## Goal review`. Do not check
   coding standards; that is `code-review`'s job.
5. Grade each finding. Blocking: an issue requirement or "done when" not met,
   drift from the Goal, a Non-goal touched, an Objective broken (a Met one
   included). Everything else is non-blocking. The verdict is `blocked` if
   there is at least one blocking finding, else `pass`.
6. List the PR's comments again; if a marker for this SHA and agent exists
   now, end. Otherwise post exactly one PR comment:

   ```markdown
   <!-- goal-agent-review:<name> sha=<40-hex head SHA> verdict=pass|blocked -->
   > *This was generated by AI: <name> Goal agent.*

   **Verdict: pass | blocked**

   ### Blocking
   - <finding>, `path/to/file:line`. <Which requirement, Objective or Non-goal.>

   ### Non-blocking
   - <finding>, `path/to/file:line`.

   ### Follow-ups filed
   - owner/repo#<n> <title>
   ```

7. File a finding outside the PR's scope as a follow-up, as in Filing a
   Finding above, and insert it into `## Order`.
8. Commit and push memory if it changed; edit `Last run`.

Your only writes are that comment, follow-up issues, the State issue and
memory. Never approve, request changes, push to the PR branch, merge, or
create tags or releases. The comment is the report. Review every new head SHA
of a non-draft PR once; never loop review and fix until clean.

### Consultation session

A question is a comment opening with `> *Question for <name> Goal agent.*`
on an issue in a Covered repo, by an `OWNER`, `MEMBER` or `COLLABORATOR`.

1. List the issue's comments; if you already answered this question, end.
2. Read the issue, its comments, your Order and Progress, and anything the
   question needs.
3. Answer each numbered question in one marked comment on the same issue,
   naming the question: a recommendation on scope, Objective, Order place or
   "done when". You may propose Goal-derived "Done when" criteria. Never
   decide, never touch labels, file nothing.
4. Edit `Last run`.
````

## Appendix C: `docs/agents/issue-tracker.md` § Goal agent operations in the Home repo

Ready to paste beside Wayfinding operations in the Home repo's `docs/agents/issue-tracker.md`. Every call is `gh api` REST, because GraphQL is blocked in a cloud session; `<home>` is the Home repo and `<repo>` a Covered repo, both as `owner/repo`. There is no GitLab variant ([R23](#r23)).

```markdown
## Goal agent operations

Used by this Home repo's Goal agent (see `docs/agents/goal-agents.md`). The
State issue (`goal-agent:state`), like `wayfinder:*` issues, is not triage
work; issues labelled `goal-agent:<name>` in the Covered repos are. Use
`gh api` only; `gh issue` and `gh pr` fail in a cloud session. Call
`add_repo` for a Covered repo before the first call to it.

- **Labels**: `goal-agent:state` here; `goal-agent:<name>` in every Covered
  repo. Never create a label; a missing one is a blocker (stop and report).
- **Find the State issue**: `gh api "repos/<home>/issues?labels=goal-agent:state&state=open" --jq '.[] | select(.title | contains("<name>")) | .number'`.
  None: create it. More than one: stop and report.
- **Create the State issue**: `gh api repos/<home>/issues -f title="<name> Goal agent: state" -f labels[]=goal-agent:state -F body=@<file>`
  with the sections `## Order`, `## Deferred items`, `## Checkpoints`,
  `## Progress`.
- **Update the State issue**: `gh api repos/<home>/issues/<n> --jq '.body,.updated_at'`,
  compute, re-read, then `gh api -X PATCH repos/<home>/issues/<n> -F body=@<file>`
  and re-read to verify.
- **Comment, or edit an own comment** (`Last run`): `gh api repos/<repo>/issues/<n>/comments -F body=@<file>`;
  `gh api -X PATCH repos/<repo>/issues/comments/<id> -F body=@<file>`.
- **Issues in scope**: `gh api --paginate "repos/<repo>/issues?labels=goal-agent:<name>&state=open"`
  (drop entries with a `pull_request` key).
- **Search for a duplicate**: `gh api --paginate "repos/<repo>/issues?state=all"`
  per Covered repo, matched on title and body.
- **File a Finding**: `gh api repos/<repo>/issues -f title=... -F body=@<file> -f labels[]=needs-triage -f labels[]=<bug|enhancement> -f labels[]=goal-agent:<name>`.
- **Close an own issue before triage**: post the marked comment, then
  `gh api -X PATCH repos/<repo>/issues/<n> -f state=closed`.
- **Blocking edges** between your own flat issues:
  `gh api repos/<repo>/issues/<n>/dependencies/blocked_by -F issue_id=<blocker id>`;
  read them with `gh api repos/<repo>/issues/<n>/dependencies/blocked_by`
  and each blocker's `state`, never `issue_dependencies_summary`.
- **Read a file by path**: `gh api repos/<repo>/contents/<path> --jq .content | base64 -d`.
- **Goal review: read the PR**: `gh api repos/<repo>/pulls/<n>` (body, `head.sha`,
  `draft`), `gh api --paginate repos/<repo>/pulls/<n>/files`, and each closing
  issue with `gh api repos/<repo>/issues/<m>` and
  `gh api --paginate repos/<repo>/issues/<m>/comments`.
- **Goal review: post the verdict**: list `gh api --paginate repos/<repo>/issues/<n>/comments`
  again, then `gh api repos/<repo>/issues/<n>/comments -F body=@<file>`.
- **Merged PRs since a time**: `gh api "repos/<repo>/pulls?state=closed&sort=updated&direction=desc"`
  (keep `merged_at` after it).
```

## Appendix D: Decisions amended since filing

For readers of the decision tickets: these decisions were amended by later tickets. The body above states only the amended form.

| Original decision | Amended to | Amended by |
|---|---|---|
| [Which shared configuration may a Goal agent read, extend, or own?][8], point 3: the definition holds the agent's Objectives, watched sources, hard limits "and session contract". | The generic session lifecycle lives in the Goal agent contract in `goal-agents.md`; the definition holds only its work loop, "done" rule and extra start and end steps ([R25](#r25)). | [Is the shared Goal agent contract a doc, a preloaded skill, or both?][12], [What does a generic Goal agent definition look like?][13] |
| [How are a Goal agent's issues marked as agent-authored?][9], point 2: `goal-agent:<name>` marks the issues the agent filed (origin). | `goal-agent:<name>` marks the agent's scope; the user also applies it to their own in-scope issues; only the AI marker shows origin ([R10](#r10)). | [What does a generic Goal agent definition look like?][13] |
| Goal review design ([ADR 0001][15]): the user's session spawns the agent for a Goal review; re-review only when the user asks. | The gate fires the routine for every new head SHA; the hourly sweep is the backstop ([R30](#r30) retired, [R36](#r36), [R37](#r37)). | [How does a Goal review start without being asked?][29], [Should every Goal agent run in cross-repo mode?][44] |
| [Where does a cross-repo Goal agent live?][26] and [What changes in the contract when nobody is at the session?][28]: memory in `.claude/agent-memory/<name>/`; the routine prompt is only a pointer. | Memory in the Home repo's `memory/`, which the guard enforces ([R18](#r18)); the prompt names the owner, the Covered repos and the writes ([R44](#r44)). | [Can a single-repo routine reach its Covered repos past the auto-mode classifier?][37], [Which routine shape runs the cross-repo Goal agent?][38] |
| [Which safeguards bound an unattended agent?][33]: the audit keys on the `Goal-agent:` trailer; `Last run` is a line in the State issue body; R26 stays prose. | The audit keys on commits outside `memory/` that no merged PR brought ([R50](#r50)); `Last run` is a marked comment ([R51](#r51)); R26 is guard-enforced ([R45](#r45)). | [Which routine shape runs the cross-repo Goal agent?][38], [Where are findings filed, and how is one Order kept across repos?][27] |
| [How does a cross-repo Goal agent coexist with a single-repo Goal agent in the same repo?][40]: single-repo agents in a Covered repo; the gate fires only for agents with a Home repo. | Every agent has a Home repo and is gate-fired; two agents on one Covered repo stay allowed ([R57](#r57)). | [Should every Goal agent run in cross-repo mode?][44] |
| [Which repos and Goal does the pilot cross-repo Goal agent cover?][41]: Health includes Checkpoint lag for session-run agents. | Health checks only `Last run` staleness ([R60](#r60)). | [Should every Goal agent run in cross-repo mode?][44] |
| [How does the routing guide brief a cross-repo Goal agent?][42]: Consultation in session for single-repo agents, on the issue for cross-repo ones. | Consultation is always on the issue ([R58](#r58)). | [Should every Goal agent run in cross-repo mode?][44] |
| [Should a Goal agent file flat issues or a spec with sliced tickets?][10]: slices are not labelled and stay out of the agent's scope. | The session gives slices the spec's label so their PRs are gated; slices still never enter the Order ([R4](#r4), [R13](#r13)). | [How do the user's sessions consult the agent through issues?][30], [Where do wayfinder maps in Covered repos sit in the Order?][31] |

## Appendix E: Covered repo files

What each Covered repo holds for its Goal agents; the user writes it as part of adding the repo ([R59](#r59)).

`### Goal agents` block under `## Agent skills` in CLAUDE.md (canonical text, [R56](#r56)):

```markdown
### Goal agents

Goal agents covering this repo: see `docs/agents/goal-agents.md`.

- `<name>`: Home repo `<owner>/<name>-home`, label `goal-agent:<name>`.

Consult a Goal agent through a comment on the issue, never by running it:

1. When: `/triage` on any issue first asks each agent's Goal fit, which decides
   its `goal-agent:<name>` label. On a labelled issue, `/triage`, grilling,
   `/to-spec` and `/to-tickets` consult only before deciding its scope,
   Objective, place in the Order or "done when"; `/wayfinder` charting consults
   on the Destination, on the idea issue or on the new Map before any tickets,
   and again when the Destination is redrawn. Don't consult when the issue
   already holds the agent's answer to the same question.
2. How: post one comment on the issue the skill started from, opening with
   `> *Question for <name> Goal agent.*`, with numbered questions. The agent
   answers on the same issue; it only recommends.
3. While waiting: park that one decision and go on with the others; a
   background Monitor watches the issue for the answer, timeout about
   20 minutes. On timeout, the user decides alone; note on the issue that the
   decision was made without the agent's advice.
4. Issues created by `/to-spec` or `/to-tickets` from a labelled issue get the
   same `goal-agent:<name>` label; each ticket's "Done when" goes in its own
   body. Only the "Done when" in the issue body binds the Goal review; write
   accepted criteria there.
```

`docs/agents/goal-agents.md` (registry only, [R22](#r22)):

```markdown
# Goal agents

## Goal agents in this repo

| Goal agent | Label | Home repo |
|---|---|---|
| `<name>` | `goal-agent:<name>` | `<owner>/<name>-home` |

Each agent's contract, definition, State issue and memory live in its Home
repo. A PR whose body closes an issue labelled `goal-agent:<name>` gets a Goal
review from that agent; the `goal-agent-review` status waits for it.
```

Workflows: `.github/workflows/goal-agent-review.yml` ([R37](#r37)) and `.github/workflows/goal-agent-consult.yml` ([R54](#r54)); scripts: `.github/scripts/goal-agent-review/` (the gate and Consultation scripts copied from goal-agent, pinned); secrets per agent: `GOAL_AGENT_<NAME>_FIRE_TOKEN` and `GOAL_AGENT_<NAME>_TRIGGER_ID`.

## Appendix F: Routine prompt

The prompt of each agent's routine, kept in sync with the definition's `## Covered repos` ([R42](#r42)). It must name the owner, the Covered repos and the writes, because the auto-mode classifier passes a Covered repo write only when the user's own messages ask for it ([R44](#r44)).

```text
You are the <name> Goal agent. Read .claude/agents/<name>.md in this repo and
act as that agent, following the contract it links.

Your Covered repos are <owner>/<repo-1> and <owner>/<repo-2>. Call add_repo for
each before using it, then use gh api only; never clone.

This routine's purpose is to write to those repos' issue trackers: file issues,
post and edit comments on issues and pull requests (Goal reviews and answers to
questions), and create blocking edges between your own issues. In this repo,
<owner>/<name>-home, you edit the State issue and its comments, and commit and
push memory/ to main.

If this run has a payload, it is the URL of one pull request to review or one
question comment to answer; do only that, then end. Otherwise run the hourly
sweep.
```

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
[23]: https://github.com/hsmejky/goal-agent/issues/29
[24]: https://github.com/hsmejky/goal-agent/issues/30
[25]: https://github.com/hsmejky/goal-agent/issues/31
[26]: https://github.com/hsmejky/goal-agent/issues/32
[27]: https://github.com/hsmejky/goal-agent/issues/33
[28]: https://github.com/hsmejky/goal-agent/issues/34
[29]: https://github.com/hsmejky/goal-agent/issues/35
[30]: https://github.com/hsmejky/goal-agent/issues/36
[31]: https://github.com/hsmejky/goal-agent/issues/37
[32]: https://github.com/hsmejky/goal-agent/issues/38
[33]: https://github.com/hsmejky/goal-agent/issues/39
[34]: https://github.com/hsmejky/goal-agent/issues/40
[35]: https://github.com/hsmejky/goal-agent/issues/41
[36]: https://github.com/hsmejky/goal-agent/issues/43
[37]: https://github.com/hsmejky/goal-agent/issues/45
[38]: https://github.com/hsmejky/goal-agent/issues/46
[39]: https://github.com/hsmejky/goal-agent/issues/47
[40]: https://github.com/hsmejky/goal-agent/issues/48
[41]: https://github.com/hsmejky/goal-agent/issues/49
[42]: https://github.com/hsmejky/goal-agent/issues/50
[43]: https://github.com/hsmejky/goal-agent/issues/51
[44]: https://github.com/hsmejky/goal-agent/issues/52
[45]: adr/0002-cross-repo-goal-agent-lives-in-a-home-repo.md
[46]: adr/0003-unattended-cross-repo-goal-reviews-fired-by-the-gate.md
[47]: adr/0004-cross-repo-goal-agent-runs-as-a-guarded-single-repo-routine.md
[48]: adr/0005-every-goal-agent-runs-as-a-guarded-routine-on-a-dedicated-home-repo.md
[49]: https://github.com/hsmejky/goal-agent/pull/19
[50]: adr/0006-goal-agent-scripts-are-tested-here-and-copied-pinned-into-each-home-repo.md
[51]: adr/0007-the-guard-restricts-cloud-sessions-only.md
