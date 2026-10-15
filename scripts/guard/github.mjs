// REST-only GitHub access through `gh api` (the cloud proxy rejects GraphQL-based subcommands).
// `gh` is called through a shell so Windows resolves gh.cmd (and the test fakes on the PATH).
import { spawnSync } from "node:child_process";

const SAFE_PATH = /^[A-Za-z0-9_.\/:?&=,%-]+$/;

/** GET a REST path and return the parsed JSON. Throws on any failure. */
export function ghGet(path, { cwd } = {}) {
  if (!SAFE_PATH.test(path)) throw new Error(`unsafe gh api path: ${path}`);
  const r = spawnSync(`gh api "${path}"`, { shell: true, cwd, encoding: "utf8" });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`gh api ${path} failed (${r.status}): ${(r.stderr || "").trim()}`);
  return JSON.parse(r.stdout);
}

/** Open State issues of an agent in its Home repo. Throws on a read error. */
export function readStateIssues(home, agent, opts) {
  const issues = ghGet(`repos/${home}/issues?labels=goal-agent:state&state=open&per_page=100`, opts);
  if (!Array.isArray(issues)) throw new Error("unexpected issues response");
  const name = new RegExp(`(^|[^a-z0-9-])${agent}($|[^a-z0-9-])`);
  return issues.filter((i) => !i.pull_request && name.test(String(i.title ?? "").toLowerCase()));
}
