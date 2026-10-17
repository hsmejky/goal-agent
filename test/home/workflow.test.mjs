import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../templates");
const load = (f) => readFileSync(join(root, f), "utf8").replace(/\r\n/g, "\n").replace(/^\s*#.*$/gm, "");
const audit = load("goal-agent-audit.yml");
const stale = load("goal-agent-staleness.yml");
const drift = load("goal-agent-drift-check.yml");

test("audit runs on pushes to main only", () => {
  assert.match(audit, /push:\s*\n\s*branches: \[main\]/);
  assert.doesNotMatch(audit, /pull_request/);
});

test("drift check runs on every PR and on pushes to main, never on pull_request_target", () => {
  assert.match(drift, /^on:\s*\n\s+pull_request:\s*\n\s+push:\s*\n\s+branches: \[main\]\s*\n/m);
  assert.doesNotMatch(drift, /pull_request_target/);
});

test("the only write permission of each workflow is issues", () => {
  for (const w of [audit, stale, drift]) {
    assert.match(w, /issues: write/);
    assert.equal((w.match(/: write/g) ?? []).length, 1);
  }
});

test("staleness is scheduled daily", () => {
  assert.match(stale, /schedule:\s*\n\s*- cron: "\d+ \d+ \* \* \*"/);
});

test("each caller job is exactly one step: the goal-agent action at the <goal-agent-pin> placeholder", () => {
  for (const [w, unit] of [[audit, "home-audit"], [stale, "home-staleness"], [drift, "home-drift-check"]]) {
    assert.equal((w.match(/^\s*- /gm) ?? []).length - (w.match(/^\s*- cron:/gm) ?? []).length, 1);
    assert.match(w, new RegExp(`steps:\\s*\\n\\s*- uses: hsmejky/goal-agent/\\.github/actions/${unit}@<goal-agent-pin>\\s*(\\n|$)`));
  }
});

test("a caller passes nothing to the action and runs no script of its own", () => {
  for (const w of [audit, stale, drift]) {
    assert.doesNotMatch(w, /^\s*(with|env|run|secrets):/m);
    assert.doesNotMatch(w, /scripts\//);
  }
});

const sync = load("goal-agent-sync.yml");

test("sync is started by hand with one required target input, and on nothing else", () => {
  assert.match(sync, /^on:\s*\n\s+workflow_dispatch:\s*\n\s+inputs:\s*\n\s+target:\s*\n(\s+.*\n)*?\s+required: true\n/m);
  assert.equal((sync.match(/^\s{6}[a-z-]+:\s*$/gm) ?? []).length, 1, "one input");
  assert.doesNotMatch(sync, /pull_request|push:|schedule:/);
});

test("sync's only permissions are contents: write and pull-requests: write, and it holds no secrets", () => {
  assert.match(sync, /^permissions:\s*\n\s+contents: write\s*\n\s+pull-requests: write\s*\n/m);
  assert.equal((sync.match(/: write/g) ?? []).length, 2);
  assert.doesNotMatch(sync, /secrets|toJSON|^\s*(run|env):/m);
});

test("sync's job is one step: the home-sync action at the <goal-agent-pin> placeholder, passing the target only", () => {
  assert.equal((sync.match(/^\s*- /gm) ?? []).length, 1);
  assert.match(sync, /steps:\s*\n\s*- uses: hsmejky\/goal-agent\/\.github\/actions\/home-sync@<goal-agent-pin>\n\s+with:\n\s+target: \$\{\{ inputs\.target \}\}\s*$/);
});
