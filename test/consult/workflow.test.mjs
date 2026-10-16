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

test("the job has one step: the goal-agent consult action at the goal-agent-pin", () => {
  const steps = code.split(/^\s*steps:\s*$/m)[1];
  assert.equal((steps.match(/^\s*- /gm) ?? []).length, 1);
  assert.match(steps, /^\s*- uses: hsmejky\/goal-agent\/\.github\/actions\/consult@<goal-agent-pin>\s*$/m);
  assert.doesNotMatch(code, /run:/);
});

test("the credentials reach the action by name in the step env, one pair per installed agent", () => {
  assert.match(code, /env:\s*\n\s*GOAL_AGENT_GOAL_STEWARD_FIRE_TOKEN: \$\{\{ secrets\.GOAL_AGENT_GOAL_STEWARD_FIRE_TOKEN \}\}\s*\n\s*GOAL_AGENT_GOAL_STEWARD_TRIGGER_ID: \$\{\{ secrets\.GOAL_AGENT_GOAL_STEWARD_TRIGGER_ID \}\}/);
  assert.doesNotMatch(code, /GOAL_AGENT_SECRETS/);
  assert.doesNotMatch(code, /toJSON|secrets: inherit/);
});
