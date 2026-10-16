import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../templates");
const load = (f) => readFileSync(join(root, f), "utf8").replace(/^\s*#.*$/gm, "");
const audit = load("goal-agent-audit.yml");
const stale = load("goal-agent-staleness.yml");

test("audit runs on pushes to main only", () => {
  assert.match(audit, /push:\s*\n\s*branches: \[main\]/);
  assert.doesNotMatch(audit, /pull_request/);
});

test("the only write permission of either workflow is issues", () => {
  for (const w of [audit, stale]) {
    assert.match(w, /issues: write/);
    assert.equal((w.match(/: write/g) ?? []).length, 1);
  }
});

test("staleness is scheduled daily", () => {
  assert.match(stale, /schedule:\s*\n\s*- cron: "\d+ \d+ \* \* \*"/);
});

test("each workflow runs its script", () => {
  assert.match(audit, /node scripts\/home\/audit\.mjs/);
  assert.match(stale, /node scripts\/home\/staleness\.mjs/);
});
