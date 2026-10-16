import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const text = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../templates/goal-agent-consult.yml"), "utf8");
const code = text.replace(/^\s*#.*$/gm, "");

test("triggers on issue_comment created and edited only", () => {
  assert.match(code, /on:\s*\n\s*issue_comment:\s*\n\s*types: \[created, edited\]\s*\n/);
  assert.doesNotMatch(code, /^\s*pull_request(_target)?:/m);
});

test("permissions are contents: read only; nothing can write the tracker", () => {
  assert.match(code, /permissions:\s*\n\s*contents: read\s*\n/);
  assert.doesNotMatch(code, /: write/);
});

test("PR comments are skipped and the comment is never interpolated into a shell", () => {
  assert.match(code, /if: \$\{\{ !github\.event\.issue\.pull_request \}\}/);
  assert.doesNotMatch(code, /github\.event\.comment\.body/);
  assert.doesNotMatch(code, /ref:/);
});

test("the credentials reach only the consult script, by name, one pair per installed agent", () => {
  assert.match(code, /GOAL_AGENT_GOAL_STEWARD_FIRE_TOKEN: \$\{\{ secrets\.GOAL_AGENT_GOAL_STEWARD_FIRE_TOKEN \}\}/);
  assert.match(code, /GOAL_AGENT_GOAL_STEWARD_TRIGGER_ID: \$\{\{ secrets\.GOAL_AGENT_GOAL_STEWARD_TRIGGER_ID \}\}/);
  assert.doesNotMatch(code, /GOAL_AGENT_SECRETS/);
  assert.doesNotMatch(code.replace(/^\s*#.*$/gm, ""), /toJSON/);
  assert.match(code, /run: node \.github\/scripts\/goal-agent-review\/consult\.mjs/);
});
