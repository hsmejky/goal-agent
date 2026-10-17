// The Covered repo drift-check caller template (ADR 0011).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { COVERED_DRIFT_TEMPLATE } from "../../scripts/render/render.mjs";

const text = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../templates", COVERED_DRIFT_TEMPLATE), "utf8");
const code = text.replace(/\r\n/g, "\n").replace(/^\s*#.*$/gm, "");

test("runs on every PR and on pushes to main, never on pull_request_target", () => {
  assert.match(code, /^on:\s*\n\s+pull_request:\s*\n\s+push:\s*\n\s+branches: \[main\]\s*\n/m);
  assert.doesNotMatch(code, /pull_request_target/);
});

test("contents: read is the only permission", () => {
  assert.match(code, /^permissions:\s*\n\s+contents: read\s*\n(?!\s+\S)/m);
  assert.doesNotMatch(code, /: write/);
});

test("holds no secrets and passes nothing to the action", () => {
  assert.doesNotMatch(code, /secrets|toJSON/);
  assert.doesNotMatch(code, /^\s*(with|env|run):/m);
});

test("the job is one step: the covered-drift-check action at the <goal-agent-pin> placeholder", () => {
  assert.equal((code.match(/^\s*- /gm) ?? []).length, 1);
  assert.match(code, /steps:\s*\n\s*- uses: hsmejky\/goal-agent\/\.github\/actions\/covered-drift-check@<goal-agent-pin>\s*$/);
});
