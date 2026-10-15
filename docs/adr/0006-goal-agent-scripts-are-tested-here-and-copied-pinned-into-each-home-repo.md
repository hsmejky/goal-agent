---
status: accepted
---

# The guard, gate and Consultation scripts are tested in goal-agent and copied, pinned, into each Home repo

The guard (the `SessionStart` and `PreToolUse` hooks), the gate and the Consultation workflow's script, with their tests, live in this goal-agent repo as the tested source. Setup copies them into each Home repo, and every copy is pinned to a goal-agent commit or tag, recorded in the Home repo. The Home repo's hooks and workflows run the copy committed there, never code fetched at run time. This resolves the design document's "described here, not shipped" wording for section 11: the design stays the specification, and the scripts are the tested implementation of it. The user still installs each Covered repo's workflow as part of adding the repo, and the agent never writes any of these files. The scripts are tested at their process boundary, with `gh` and `curl` faked on the `PATH`. Scripts that run inside the routine reach GitHub only through REST `gh api`, because the cloud GitHub proxy rejects GraphQL-based `gh` subcommands.

## Considered Options

- **Scripts maintained in each Home repo**: rejected because every agent would carry its own untested variant of security-relevant code, and a fix would have to be made once per Home repo with no shared test suite.
- **Home repos fetch a pinned version when they run**: rejected because the guard must run the copy committed on the Home repo's `origin/main` (R45), so a fetch at run time would add a network dependency and an unreviewed code path at the point the agent is least supervised. A fetched script would also not appear in the Home repo's PR review or its audit of `main` (R50).

## Consequences

- Copies can drift from the source, and from each other. The pin makes drift detectable: a Home repo's recorded commit or tag can be compared with the goal-agent tag, and the copied files can be diffed against the source at that pin. A copy that differs from its pin has been edited locally; a pin behind the latest tag is out of date.
- Updating a Home repo's scripts is a user PR in that Home repo, so the audit of `main` sees it like any other change to the guard.
- A fix to a script reaches an agent only when the user bumps that Home repo's pin.
- ADRs 0001–0005 stay as written. The gate they describe is now specified by tested source rather than written freehand per repo.
