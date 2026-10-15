// Home repo audit (R50). Runs on every push to `main`: a pushed commit that touches a path outside
// `memory/` and has no merged PR sets the halt marker on the State issue and opens one issue (or
// comments on the one already open). Nothing is reverted.
// Environment: GITHUB_REPOSITORY, GITHUB_EVENT_PATH (push payload), optional GOAL_AGENT_NAME.
// The Actions push payload lists at most 2048 commits; the audit checks those. A larger push is
// only partly covered (the compare API would be needed to cover it).
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { ghApi } from "../gate/github.mjs";
import { readStateIssues } from "../guard/state-issues.mjs";
import { agentName, openOrComment, setHalted } from "./lib.mjs";

export const AUDIT_MARKER = "<!-- goal-agent:audit -->";
const HALT_LINE = "<!-- goal-agent:halted set by the Home repo audit -->";

const outsideMemory = (path) => !path.startsWith("memory/");
const isMerged = (pr) => pr.merged === true || Boolean(pr.merged_at);

/** The pushed commits that touch something outside `memory/` and arrived through no merged PR. */
export function findOffences(repo, commits) {
  const offences = [];
  for (const c of commits) {
    const detail = ghApi(`repos/${repo}/commits/${c.id}`);
    // A rename moves content, so its source path counts too (a file renamed into memory/ came from outside it).
    if (!(detail.files ?? []).some((f) => outsideMemory(f.filename) || (f.previous_filename && outsideMemory(f.previous_filename)))) continue;
    const prs = ghApi(`repos/${repo}/commits/${c.id}/pulls`) ?? [];
    if (prs.some(isMerged)) continue;
    offences.push({ sha: c.id, subject: String(c.message ?? "").split(/\r?\n/)[0] });
  }
  return offences;
}

export function audit(repo, agent, commits) {
  const offences = findOffences(repo, commits);
  if (offences.length === 0) return { offences };
  const states = readStateIssues(repo, agent);
  for (const s of states) setHalted(repo, s.number, HALT_LINE);
  const list = offences.map((o) => `- ${o.sha.slice(0, 12)} ${o.subject}`.trimEnd()).join("\n");
  const haltNote = states.length === 0
    ? "No State issue was found, so the agent could not be halted."
    : `The agent is Halted: the halt marker is on ${states.map((s) => `#${s.number}`).join(", ")}. Only you clear it.`;
  const body = `Commits on \`main\` touch paths outside \`memory/\` and arrived through no merged pull request:\n\n${list}\n\n${haltNote} Nothing was reverted.`;
  const result = openOrComment(repo, { marker: AUDIT_MARKER, title: `Goal agent audit: ${agent} commits outside memory without a merged PR`, body });
  return { offences, ...result };
}

function main() {
  const payload = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const result = audit(process.env.GITHUB_REPOSITORY, agentName(), (payload.commits ?? []).filter((c) => c.id));
  console.log(result.offences.length ? `audit: ${result.offences.length} offending commit(s); ${result.action} #${result.number}` : "audit: clean");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (e) { console.error(`audit failed: ${e.message}`); process.exit(1); }
}
