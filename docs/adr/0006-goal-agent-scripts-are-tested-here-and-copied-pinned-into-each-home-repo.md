---
status: accepted, amended by R25, R59, ADR 0008, ADR 0010 and ADR 0011
---

# The guard, gate and Consultation scripts are tested in goal-agent and copied, pinned, into each Home repo

The guard (the `SessionStart` and `PreToolUse` hooks), the gate and the Consultation workflow's script, with their tests, live in this goal-agent repo as the tested source. The Home repo setup steps copy them into each Home repo, and every copy is pinned to a goal-agent commit or tag. The pin is recorded in a `goal-agent-pin` field of the agent definition in the Home repo, which the Home repo setup steps write (amended, see [Amendments](#amendments)). There is no setup script for Covered repos; the user's checklists cover those. The Home repo's hooks and workflows run the copy committed there, never code fetched at run time (superseded, see [Amendments](#amendments)). This resolves the design document's "described here, not shipped" wording for section 11: the design stays the specification, and the scripts are the tested implementation of it. The user still installs each Covered repo's workflow as part of adding the repo, and the agent never writes any of these files. The scripts are tested at their process boundary, with `gh` and `curl` faked on the `PATH`. Scripts that run inside the routine reach GitHub only through REST `gh api`, because the cloud GitHub proxy rejects GraphQL-based `gh` subcommands.

## Considered Options

- **Scripts maintained in each Home repo**: rejected because every agent would carry its own untested variant of security-relevant code, and a fix would have to be made once per Home repo with no shared test suite.
- **Home repos fetch a pinned version when they run** (superseded, see [Amendments](#amendments)): rejected because the guard must run the copy committed on the Home repo's `origin/main` (R45), so a fetch at run time would add a network dependency and an unreviewed code path at the point the agent is least supervised. A fetched script would also not appear in the Home repo's PR review or its audit of `main` (R50).

## Consequences

- Copies can drift from the source, and from each other (superseded, see [Amendments](#amendments)). The pin makes drift detectable: anyone can read a Home repo's `goal-agent-pin`, compare it with the goal-agent tag, and diff the copied files against the source at that pin. A copy that differs from its pin has been edited locally; a pin behind the latest tag is out of date.
- Updating a Home repo's scripts is a user PR in that Home repo, so the audit of `main` sees it like any other change to the guard.
- Updating the copies includes updating the definition's `goal-agent-pin` in the same PR, so the field never names a version the copies are not.
- A fix to a script reaches an agent only when the user bumps that Home repo's pin (for a shared Covered repo copy, every sharing Home repo's pin, see [Amendments](#amendments)).
- ADRs 0001–0005 stay as written. The gate they describe is now specified by tested source rather than written freehand per repo.

## Amendments

- **What the pin names, amended by [R25][r25] (issue [#87][i87]).** `goal-agent-pin` names the goal-agent commit or tag that both the Home repo's copied scripts and the adopted text (Appendices A-C of the design and its R59 checklists) came from. The user bumps it whenever either is re-adopted, including when only the text changed and no script did, in the same Home repo PR. This widens "the copies" in the Consequences above to the text as well as the scripts. [R59][r59] has the re-adoption checklist.
- **A Covered repo's gate copy is shared, amended by [R59][r59] (issue [#94][i94]).** A Covered repo has one copy of `scripts/gate/*.mjs`, and every Goal agent covering it runs that copy. All Home repos covering one Covered repo therefore use one shared `goal-agent-pin`, and the copy is at that pin when it is byte-identical to `scripts/gate/*.mjs` there. A pin bump is one coordinated change: a PR in every Home repo sharing the Covered repo, plus a Covered repo PR only if a file under `scripts/gate/` changed between the old and the new pin. This replaces "pinned per Home repo" for the Covered repo copy. Drift in that copy is checked by diffing it against the source at the shared pin, which is not stored in the Covered repo but read from the `goal-agent-pin` in the definition of each Home repo registered in the Covered repo's `docs/agents/goal-agents.md` (Appendix A); unequal pins are drift. When a Home repo removes the Covered repo, the copy stays at the pin the remaining Home repos share, and goes away with the last one.
- **Workflows and contract text, amended by [ADR 0008][adr8] (issue [#111][i111]).** ADR 0008's Decision supersedes this ADR for the gate, Consultation, audit and staleness workflows (including the shared gate copy above and the rejected "fetch a pinned version" option, for those workflows) and amends it for the contract text. The guard stays as decided here.
- **The guard decision stands, backed by a verified answer, amended by [ADR 0010][adr10] and [ADR 0011][adr11] ([#143][i143]).** Those two ADRs change how a pin bump reaches a Home repo (the Pin move, a local command), not what the pin names or where the guard runs from. The plugin route that ADR 0008 left open came back "no" in [#101][i101], as ADR 0008 records, so the guard stays tested here and a committed copy on each Home repo's `origin/main`.

[adr10]: 0010-goal-agent-prs-across-repos-are-opened-locally-with-the-users-token.md
[adr11]: 0011-a-pin-move-opens-one-caller-pr-per-covered-repo-checked-by-its-own-drift-check.md
[i101]: https://github.com/hsmejky/goal-agent/issues/101
[i143]: https://github.com/hsmejky/goal-agent/issues/143
[adr8]: 0008-goal-agent-workflows-run-from-goal-agent-at-the-pinned-sha.md
[r25]: ../goal-agents-with-engineering-skills.md#r25
[r59]: ../goal-agents-with-engineering-skills.md#r59
[i87]: https://github.com/hsmejky/goal-agent/issues/87
[i94]: https://github.com/hsmejky/goal-agent/issues/94
[i111]: https://github.com/hsmejky/goal-agent/issues/111
