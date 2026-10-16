import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../templates");
const load = (f) => readFileSync(join(root, f), "utf8").replace(/^\s*#.*$/gm, "");
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
