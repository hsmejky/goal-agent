// The State issue query shared by the guard (SessionStart), the Home repo audit and the staleness check.
import { ghList } from "../gate/github.mjs";

/** Open State issues of an agent in its Home repo, across all pages. Throws on a read error. */
export function readStateIssues(homeRepo, agent, opts) {
  const issues = ghList(`repos/${homeRepo}/issues?labels=goal-agent:state&state=open`, opts);
  const name = new RegExp(`(^|[^a-z0-9-])${agent}($|[^a-z0-9-])`);
  return issues.filter((i) => !i.pull_request && name.test(String(i.title ?? "").toLowerCase()));
}
