# Subagent `skills:` frontmatter: what it loads, and when

Research for issue #11. Researched 2026-10-14 against the live docs and the CHANGELOG (latest entry read: 2.1.299).

Sources:
- SUB = https://code.claude.com/docs/en/sub-agents
- SK = https://code.claude.com/docs/en/skills
- CL = https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md

## 1. What is loaded, and when

- Full content, at startup. "The full content of each listed skill is injected into the subagent's context at startup" and "the full skill content is injected, not only the description" (SUB, "Preload skills into subagents" and the frontmatter table). Contrast with a normal session, where only descriptions are listed and the body loads on invoke (SK, "Invocation control").
- Referenced supporting files are not mentioned as preloaded. Only SKILL.md content is described as injected. Treat supporting files as not preloaded (unconfirmed either way).
- Startup context of a custom subagent: its own markdown body as system prompt plus environment details, the CLAUDE.md hierarchy (unless `omitClaudeMd: true`, v2.1.271+), and the preloaded skills. The subagent does not see the parent conversation or skills the parent already invoked (SUB, "What loads at startup").
- Role of the delegation message: for a subagent with `skills`, the prompt is the subagent's markdown body, and the user turn is Claude's delegation message; preloaded skills and CLAUDE.md come from startup context (SK, comparison table under "Run skills in a subagent").
- Ordering relative to the body: not documented. Unconfirmed. Changelog 2.1.265 says preloaded skills sit in "the prompt prefix" and were being moved out on later turns, breaking prompt-cache reuse (fixed) (CL, 2.1.265).

## 2. Which skill locations can be named

- Names are resolved from the same set Claude can invoke: project, user, plugin (and others in SK "Choose where skills load"). SUB states a listed skill that is missing or disabled (for example by org policy) is skipped with a warning in the debug log only (SUB). A typo therefore fails silently.
- Plugin skills: the namespaced form is `/plugin-name:skill-name` (SK, "Skill locations"). Changelog 2.1.47 "Fixed plugin agent skills silently failing to load when referenced by bare name instead of fully-qualified plugin name" (CL, 2.1.47). The exact accepted syntax in a `skills:` list is not shown in the docs excerpt read: unconfirmed; use the fully-qualified `plugin:skill` name to be safe.
- Collision precedence among enterprise/personal/project: enterprise > personal > project (SK). Plugin skills are namespaced so do not collide.
- Feature origin: "Added skills frontmatter field to declare skills to auto-load for subagents" (CL, 2.0.43).

## 3. Does a preloaded skill behave normally elsewhere?

- Yes. Preloading only copies content into that subagent; it does not change the skill. The skill keeps its normal listing, `/name` invocation and auto-trigger in the main session, since the field "controls which skills are preloaded, not which skills the subagent can access" (SUB).
- A subagent can still invoke unlisted project, user and plugin skills through the Skill tool, unless `Skill` is omitted from `tools` or put in `disallowedTools` (SUB). Changelog 2.1.133 fixed "subagents not discovering project, user, or plugin skills via the Skill tool" (CL, 2.1.133).
- A skill with `disable-model-invocation: true` cannot be preloaded (SUB; SK frontmatter table). Consequence: a skill meant to be user-only (`/name` only) cannot also be preloaded.
- `user-invocable: false` hides the skill from the `/` menu but Claude can still invoke it (SK). The docs do not say explicitly that such a skill can be preloaded; since preloading draws from "the same set of skills Claude can invoke", it should be (inference, unconfirmed).
- Built-in agents do not preload skills (SUB).
- Inverse direction, different mechanism: `context: fork` + `agent:` in a SKILL.md runs the skill as the task prompt of a subagent (SK, "Run skills in a subagent").
- Skills invoked inside a subagent no longer leak into main-session context after compaction (CL, 2.1.45).

## 4. Limits and known issues

- At most 32 distinct names are preloaded, each once; the rest remain invokable via the Skill tool (SUB; CL 2.1.295).
- No documented per-skill size cap for preloading. Related but different limits: description + when_to_use is truncated at 1,536 characters in the skill listing, and post-compaction re-attachment keeps 5,000 tokens per skill with a 25,000-token shared budget (SK). Whether those apply to preloaded skills is unconfirmed. Preloaded bodies are full-size context, so large skills cost every subagent run.
- Main session agents: running `claude --agent <name>` was reported not to preload skills like a subagent does (issue 29902, mirror: https://claudeissues.com/issue/29902-bug-running-claude-with-agent-doesnt-preload-skills-like-subagents, marked resolved 2026-04-16 on the mirror; the fixing version was not located in the CHANGELOG). Treat as unconfirmed for the version in use. SUB notes `omitClaudeMd` is ignored when the agent runs as main session agent via `--agent`.
- Silent skip of missing/disabled skills (see section 2).
- Cache behaviour fixed in 2.1.265 (CL).

## 5. Preloading versus "read docs/agents/goal-agents.md at session start"

| Aspect | `skills:` preload | Body says "read the file" |
|---|---|---|
| Guaranteed in context | Yes, injected by the harness at startup (SUB) | No, depends on the model following the instruction and the Read tool being allowed |
| Cost | Full body always paid, even if unused | Paid only when read; adds a tool turn |
| Failure mode | Silent skip if name missing/disabled/over 32 | Model may skip or truncate the read; file missing gives a visible tool error |
| Distribution | Skill must be discoverable from project/user/plugin location | A plain repo file; no skill machinery |
| Reuse | Same skill also usable from main session and other agents | File reusable by any agent that is told to read it |

No document states that either is "guaranteed" in the sense of surviving compaction in a subagent; the preloaded-at-startup guarantee is the documented one. CLAUDE.md is also loaded into every custom subagent by default (SUB), so a pointer there is a third guaranteed channel, unless `omitClaudeMd` is set.

## Unconfirmed list

- Ordering of preloaded skills relative to the body in the prompt.
- Whether SKILL.md-referenced supporting files are preloaded.
- Exact plugin-skill syntax in `skills:` (fully-qualified recommended).
- Whether `user-invocable: false` skills preload (inferred yes).
- Version that fixed `--agent` not preloading skills.
- Whether the 1,536-char and compaction budgets apply to preloaded skills.
