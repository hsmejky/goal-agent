import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const text = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../templates/goal-agent-review.yml"), "utf8");
const code = text.replace(/^\s*#.*$/gm, "");

test("triggers: pull_request_target and issue_comment with the specified types, never pull_request", () => {
  assert.match(code, /pull_request_target:\s*\n\s*types: \[opened, synchronize, reopened, edited, ready_for_review\]/);
  assert.match(code, /issue_comment:\s*\n\s*types: \[created, edited, deleted\]/);
  assert.doesNotMatch(code, /^\s{2}pull_request:/m);
});

test("permissions are read except statuses: write", () => {
  assert.match(code, /permissions:\s*\n\s*contents: read\s*\n\s*pull-requests: read\s*\n\s*issues: read\s*\n\s*statuses: write\s*\n/);
  assert.doesNotMatch(code, /(?<!statuses): write/);
});

test("nothing from the PR is checked out or executed", () => {
  assert.doesNotMatch(code, /ref:/);
  assert.doesNotMatch(code, /github\.event\.pull_request\.head/);
});

test("concurrency: one group per PR and event kind, no cancellation", () => {
  assert.match(code, /group: goal-agent-review-.*github\.event_name/);
  assert.match(code, /cancel-in-progress: false/);
});

test("comment events on plain issues are skipped", () => {
  assert.match(code, /github\.event\.issue\.pull_request/);
});

test("the fire credentials reach the script by name, one pair per installed agent, never as the secrets object", () => {
  assert.match(code, /GOAL_AGENT_GOAL_STEWARD_FIRE_TOKEN: \$\{\{ secrets\.GOAL_AGENT_GOAL_STEWARD_FIRE_TOKEN \}\}/);
  assert.match(code, /GOAL_AGENT_GOAL_STEWARD_TRIGGER_ID: \$\{\{ secrets\.GOAL_AGENT_GOAL_STEWARD_TRIGGER_ID \}\}/);
  assert.doesNotMatch(code, /GOAL_AGENT_SECRETS/);
  assert.doesNotMatch(code.replace(/^\s*#.*$/gm, ""), /toJSON/);
});

test("issues trigger on labeled and unlabeled; its runs are grouped apart from pull_request_target runs", () => {
  assert.match(code, /issues:\s*\n\s*types: \[labeled, unlabeled\]/);
  assert.match(code, /group: goal-agent-review-.*github\.event_name/);
});
