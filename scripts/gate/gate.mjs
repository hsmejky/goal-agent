// The Goal review gate (R37): evaluates a PR and sets the commit status `goal-agent-review` on its head SHA.
// Runs from the default branch under `pull_request_target` / `issue_comment`; reads only the API.
// Environment: GITHUB_REPOSITORY, GITHUB_EVENT_NAME, GITHUB_EVENT_PATH (and gh's own GH_TOKEN).
//
// Structure (open for later tickets):
//   targetsFromEvent()  event -> PR numbers to evaluate        (label-change events add a mapping here)
//   evaluate()          PR -> { state, description, missing }  (the fire step reads `missing`)
//   report()            posts the status
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseClosingRefs } from "./closing-refs.mjs";
import { agentNames, CONTEXT, decide, latestVerdict } from "./evaluate.mjs";
import { ghApi, ghList, GhError } from "./github.mjs";

const rest = (repo, path) => `repos/${repo}/${path}`;

/** PR numbers an event asks us to evaluate; throws on events the workflow should not deliver. */
export function targetsFromEvent(name, payload) {
  if (name === "pull_request_target") {
    if (!payload.pull_request?.number) throw new Error("pull_request_target event without a pull request number");
    return [payload.pull_request.number];
  }
  if (name === "issue_comment") return payload.issue?.pull_request ? [payload.issue.number] : [];
  throw new Error(`unsupported event "${name}"`);
}

/** Labels of the issues the PR body closes, read in each issue's own repo. A missing issue gates nothing. */
function closingIssueLabels(repo, body) {
  const labels = [];
  for (const ref of parseClosingRefs(body)) {
    try {
      const issue = ghApi(rest(ref.repo ?? repo, `issues/${ref.number}`));
      labels.push(...issue.labels.map((l) => (typeof l === "string" ? l : l.name)));
    } catch (e) {
      if (e instanceof GhError && e.status === 404) continue;
      throw e;
    }
  }
  return labels;
}

/** Everything the gate decides for one PR, without writing. */
export function evaluate(repo, pr) {
  const agents = agentNames(closingIssueLabels(repo, pr.body));
  if (agents.length === 0) return { agents, ...decide([], () => null) };
  const comments = ghList(rest(repo, `issues/${pr.number}/comments`));
  return { agents, ...decide(agents, (name) => latestVerdict(comments, name, pr.head.sha)) };
}

export function report(repo, sha, { state, description }) {
  ghApi(rest(repo, `statuses/${sha}`), { method: "POST", body: { state, context: CONTEXT, description: description.slice(0, 140) } });
}

export function main(env = process.env) {
  const repo = env.GITHUB_REPOSITORY;
  const payload = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
  let failed = false;
  for (const number of targetsFromEvent(env.GITHUB_EVENT_NAME, payload)) {
    let sha = payload.pull_request?.head?.sha; // fallback for the error status only; the verdict uses the REST head
    try {
      const pr = ghApi(rest(repo, `pulls/${number}`));
      sha = pr.head.sha;
      report(repo, sha, evaluate(repo, pr));
    } catch (e) {
      failed = true;
      console.error(`goal-agent-review: PR #${number}: ${e.message}`);
      try {
        if (sha) report(repo, sha, { state: "error", description: "Goal review gate error: see the workflow run" });
      } catch (e2) {
        console.error(`goal-agent-review: could not post the error status: ${e2.message}`);
      }
    }
  }
  return failed ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch (e) {
    console.error(`goal-agent-review: ${e.message}`);
    process.exitCode = 1;
  }
}
