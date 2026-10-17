---
status: proposed
---

# The Roster and the definitions are the record; each Registry is rendered from them

Which Goal agents exist, and which repos each covers, is recorded in two places only: the **Roster** (`docs/home-repos.md` in goal-agent, one row per Goal agent naming its Home repo, edited by hand) and each definition's `## Covered repos` in its Home repo. A Covered repo's **Registry** (`docs/agents/goal-agents.md` § Goal agents in this repo) keeps its place and three-column format, but is rendered from the definitions that list that repo and is never edited by hand. A fleet-wide action starts from the Roster, reads each definition, and opens a PR wherever a Registry differs from what the definitions give, so a disagreement surfaces as a PR rather than as a check. Decided in [Where the one registry of Goal agents, Home repos and Covered repos lives][i137].

## Considered options

- **One central table of agent, Home repo and Covered repos, rendering both the definitions' lists and the Registries.** Rejected: three copies of each pairing, and the glossary already makes the definition the list a Covered repo belongs to.
- **Both lists kept by hand, as before, with the action only cross-checking.** Rejected: adding a Goal agent stays two hand edits that can disagree.
- **Covered repo checks reading the Roster or the definitions at PR time.** Rejected: a private Home repo's definition needs a cross-repo read credential in the Covered repo's checks. The Registry stays the only file those checks read.
- **The Roster outside goal-agent** (a private repo, a local file, a GitHub topic). Rejected: an extra repo to keep, no history, or a hand step invisible in review. The cost of the chosen place: goal-agent is public, so the Roster publishes the names of private Home repos, as goal-agent's own Registry already does for goal-steward-home.

## Consequences

- The guard keeps reading the definition's `## Covered repos` (R42, R45); its inputs do not change.
- The callers' secret pairs and the Covered repo's caller drift check keep reading the Registry; the Home repo drift check keeps reading only the Home repo.
- The sync's `registryHomes`, which found the other Home repos through the Registries to list their sync steps, retires with that checklist.
- goal-steward's `registries` Watched source stays valid; adding the Roster to it is goal-steward's Definition proposal to make.

[i137]: https://github.com/hsmejky/goal-agent/issues/137
