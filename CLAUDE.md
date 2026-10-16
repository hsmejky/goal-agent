## Project language

Write project artifacts in English, including documentation, specifications, issues, ADRs, glossary entries, research notes, code comments, commit messages, and pull request text. User-facing conversation may remain in the user's language.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on hsmejky/goal-agent (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.

### Goal agents

Goal agents covering this repo: see `docs/agents/goal-agents.md`.

- `goal-steward`: Home repo `hsmejky/goal-steward-home`, label `goal-agent:goal-steward`.

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
