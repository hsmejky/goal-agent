# Routing a new idea

Where to take an idea for extending a repo that has a **Goal agent** and the **Engineering skills** set up. The right entry point depends on how clear the idea is, how big it is, and whether it touches the Goal agent's Goal. Terms in bold are defined in [`GLOSSARY.md`](../GLOSSARY.md); recommendations R1–R37 are in [`goal-agents-with-engineering-skills.md`](goal-agents-with-engineering-skills.md).

## 1. The entry points

| Entry point | What it gives you | What it leaves behind |
|---|---|---|
| File an issue, then `/triage` | The user's endorsement gate: category, state label, Agent Brief | A `needs-triage` issue that becomes `ready-for-agent` or `ready-for-human` |
| Plain conversation with Claude | Fast thinking out loud, a quick answer, a trivial edit | Nothing durable unless it ends in an issue, a commit or a doc |
| Brief the Goal agent | A judgement against its Goal, **Objectives** and **Non-goals**, with the context of its open issues and **Order** | A reply in your session: the Objective served or Non-goal hit, the value against the Order, better alternatives |
| `/grill-with-docs` | One session of hard questions that settles the design and its terms | `GLOSSARY.md` entries, an ADR when the three ADR conditions hold, a plan ready for `/to-spec` |
| `/wayfinder` | A shared map of decision tickets for work that spans many sessions | A `wayfinder:map` issue with child tickets resolved one per session |

Two facts shape every route:

- **Triage is manual.** Nothing runs `/triage` for you; an issue sits at `needs-triage` until you run it.
- **The scope label decides the Goal review.** An issue labelled `goal-agent:<name>` enters that agent's Order, and a PR that closes it needs a **Goal review** ([R10](goal-agents-with-engineering-skills.md#r10), [R29](goal-agents-with-engineering-skills.md#r29)). Work that never becomes such an issue is never checked against the Goal.

## 2. Model situations

### A. Clear, small and in the Goal agent's scope

You know what you want and it fits one session, for example "add a `--dry-run` flag to the sync command".

1. File the issue yourself with `needs-triage`, a category label and `goal-agent:<name>`.
2. Run `/triage`. It writes the Agent Brief and moves the issue to `ready-for-agent`.
3. Implement it in your own session (`/implement` or `/tdd`), open a PR with `/pr`.
4. Run the Goal review: `Goal review of PR #<n>`.

The Goal agent places the issue in its Order at its next session, by the priority you state in the issue, otherwise by Objective rank. To have it run earlier, move it up in the State issue's `## Order` yourself.

### B. Clear and small, but outside every Goal agent's scope

Same as A without the `goal-agent:<name>` label. No Goal agent tracks it and no Goal review applies.

### C. Unsure whether, or how well, it serves the Goal

The idea may serve an Objective, collide with a Non-goal, duplicate something already filed or rejected, or move the Goal less than other work would. You want to judge it and, if needed, rethink it before anything is filed.

1. Read the Goal agent's definition (Goal, Objectives, Non-goals) and `.out-of-scope/`. That sometimes settles it.
2. **Assess.** In your session, brief the Goal agent: `Assess idea: <idea>. Reply only; file nothing.` Ask it for:
   - the Objective the idea serves, or the Non-goal it hits;
   - how much it moves that Objective compared with the open issues already in the Order;
   - overlap with existing issues, ADRs and past rejections;
   - what would serve the same Objective better, if anything.
3. **Rethink.** Run `/grill-with-docs` with the idea, the agent's reply and the definition as context. It stress-tests the reply as well as the idea; the agent's view is an input, not a verdict.
4. Act on the outcome:
   - **Reshaped or confirmed:** continue with A, D or E.
   - **Dropped:** nothing to file. If it was already an issue, close it through `/triage` as `wontfix`, which records a rejected enhancement in `.out-of-scope/`.
   - **The idea is right but the Goal is wrong:** continue with F.

The assessment is a reply, not an issue, because the idea is still moving; file once it is settled, so the tracker holds the reshaped idea rather than the first draft. The agent cannot run skills ([R26](goal-agents-with-engineering-skills.md#r26)), so the rethinking happens in your session, not in the agent. Only `Goal review of PR #<n>` is a defined brief; the assessment brief has not been tried in a trial run.

### D. Fuzzy, but one session can settle it

You have the direction but not the design: open questions, new terms, trade-offs.

1. Run `/grill-with-docs` with the idea. It updates `GLOSSARY.md` and writes an ADR only for decisions that are hard to reverse, surprising and a real trade-off.
2. If the result fits one implementation session, file it as in A. If it is **Spec-sized**, run `/to-spec`, label the spec `goal-agent:<name>` when it is in scope, then run `/to-tickets` for the slices.

### E. Large: several sessions of decisions before anything can be built

The idea needs research, prototypes or several rounds of decisions, for example "support a second host platform".

1. Run `/wayfinder`. It creates the map and decision tickets; resolve one ticket per session.
2. When the way is clear, run `/to-spec` and `/to-tickets`, labelling the spec `goal-agent:<name>` when it is in scope.

The split between D and E is session count: `/grill-with-docs` for single-session planning, `/wayfinder` for multi-session planning.

### F. The idea changes the Goal itself

A new Objective, a re-ranking, dropping a Non-goal, a new watched source. This is a change to the Goal agent's definition, which only you edit; the agent never writes it.

1. If the change is a judgement call, settle it with `/grill-with-docs` first.
2. Edit the definition (`.claude/agents/<name>.md`) and commit it.
3. For a watched source alone, the agent may also propose the change in a marked comment on its State issue ([R28](goal-agents-with-engineering-skills.md#r28)); you still make the edit.

Do not file a triage issue for this: it is about the agent, not project work.

### G. A defect you noticed

File an issue with `needs-triage`, `bug` and, when it is in scope, `goal-agent:<name>`, then go on as in A. Use `/diagnosing-bugs` first when the cause is unclear.

### H. A throwaway question or a trivial edit

Plain conversation with Claude is fine for "how does X work?" or fixing a typo. Once the conversation turns into a decision or a change worth keeping, move it to an entry point above, so it leaves an issue or a doc behind instead of disappearing with the session.

## 3. The Goal agent in a triage or grilling decision

Triage or grilling on an issue labelled `goal-agent:<name>` can hit a question only the Goal can answer: is this in scope, which Objective does it serve, where does it go in the Order, what counts as done. The Goal agent advises; you decide, and the skill records the decision. The agent never writes the Agent Brief, `GLOSSARY.md`, an ADR or `.out-of-scope/` ([R21](goal-agents-with-engineering-skills.md#r21)).

There are two ways to bring it in.

**Asynchronous: the agent filed the issue.** The agent is the reporter. Triage marks the issue `needs-info` with the question in its triage notes. The agent answers at the start of its next session, as a marked comment, without touching labels ([R7](goal-agents-with-engineering-skills.md#r7)). The next `/triage` picks the issue up again. Use this when the question is about the agent's own finding (its evidence, what it meant, why it matters) and the decision can wait.

**Synchronous: any issue in scope, decision needed now.** Pause the skill and, in the same session, brief the Goal agent: `Advise on #<n>: <question>. Reply only; file nothing.` Ask it for a recommendation with its reasons, the Objective or Non-goal involved, and any effect on the Order. Then give the reply back to the skill as your input and decide. This is the only way for an issue you filed yourself, because the agent answers `needs-info` only on its own issues.

What to ask it, and what not:

| Ask the Goal agent | Do not ask it |
|---|---|
| In scope or a Non-goal? | Implementation design, technology choice |
| Which Objective, and how much it moves it? | Coding standards (that is `code-review`'s) |
| Position in the Order, blocking edges to its other issues | Anything that edits the definition or shared configuration |
| "Done when" criteria it will check in the Goal review ([R32](goal-agents-with-engineering-skills.md#r32)) | |

The last row matters most: when triage writes the Agent Brief with the criteria the agent will check later, the Goal review checks what the brief promised.

After the decision:

- An Order change from it is yours to make in the State issue's `## Order`; the agent never moves an existing entry.
- If the decision shows the Goal itself is unclear or wrong, stop and continue with F.
- Like the assessment brief in C, the advice brief has not been tried in a trial run.

## 4. Quick choice

1. Does it change the Goal, an Objective, a Non-goal or a watched source? → F.
2. Not sure it belongs to the Goal, or whether it is worth it compared with other work? → C.
3. Does deciding what to build take more than one session? → E.
4. Are design questions or terms still open? → D.
5. Is it a defect? → G.
6. Otherwise → A, or B when it is outside every Goal agent's scope.
