// Shared by the Home repo audit (R50) and staleness check (R51). REST only, through `gh api`.
// Copied into each Home repo next to scripts/guard and scripts/gate (ADR 0006).
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { ghApi, ghList } from "../gate/github.mjs";
import { hasHaltMarker } from "../guard/halt-marker.mjs";
import { readStateIssues } from "../guard/github.mjs";

export { ghApi, ghList, hasHaltMarker };

/** The agent name: GOAL_AGENT_NAME, else the single definition in `.claude/agents/` of `cwd`. */
export function agentName(cwd = process.cwd(), env = process.env) {
  if (env.GOAL_AGENT_NAME) return env.GOAL_AGENT_NAME;
  let files = [];
  try { files = readdirSync(join(cwd, ".claude", "agents")).filter((f) => f.endsWith(".md")); } catch { /* reported below */ }
  if (files.length !== 1) throw new Error(`expected exactly one definition in .claude/agents/, found ${files.length}`);
  const name = files[0].replace(/\.md$/, "");
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`invalid agent name: ${name}`);
  return name;
}

/** Open State issues of the agent in its Home repo. */
export const stateIssues = (home, agent) => readStateIssues(home, agent);

/** The open issue (not a PR) in `repo` whose body carries the hidden `marker`, or null. */
export function findOpenMarked(repo, marker) {
  const issues = ghList(`repos/${repo}/issues?state=open`);
  return issues.find((i) => !i.pull_request && typeof i.body === "string" && i.body.includes(marker)) ?? null;
}

/** Open one issue, or comment on the open one that carries `marker`. Returns { action, number }. */
export function openOrComment(repo, { marker, title, body, quiet = false }) {
  const existing = findOpenMarked(repo, marker);
  if (existing && quiet) return { action: "none", number: existing.number };
  if (existing) {
    ghApi(`repos/${repo}/issues/${existing.number}/comments`, { method: "POST", body: { body } });
    return { action: "commented", number: existing.number };
  }
  const created = ghApi(`repos/${repo}/issues`, { method: "POST", body: { title, body: `${marker}\n${body}` } });
  return { action: "opened", number: created.number };
}

/**
 * Add the halt marker to a State issue, keeping every other body line. Re-reads the body right
 * before the write and verifies it afterwards; retries once. Returns true if it wrote.
 */
export function setHalted(repo, number, markerLine) {
  let wrote = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    const body = ghApi(`repos/${repo}/issues/${number}`).body ?? "";
    if (hasHaltMarker(body)) return wrote;
    const next = `${body}${body === "" || body.endsWith("\n") ? "" : "\n"}${markerLine}\n`;
    ghApi(`repos/${repo}/issues/${number}`, { method: "PATCH", body: { body: next } });
    wrote = true;
    if (hasHaltMarker(ghApi(`repos/${repo}/issues/${number}`).body ?? "")) return true;
  }
  throw new Error(`could not set the halt marker on ${repo}#${number}`);
}
