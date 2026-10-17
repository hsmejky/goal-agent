// The Home repo drift check (R59) at its process boundary: fixture Home repo as the checkout, goal-agent at
// 043deaa as the source, fake GitHub for the drift issue.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHarness } from "../harness/index.mjs";
import { DRIFT_MARKER } from "../../scripts/home/drift-check.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "../../scripts/home/drift-check.mjs");
const fixtures = join(here, "../fixtures");
const HOME = "hsmejky/goal-steward-home";

const cleanups = [];
after(() => cleanups.forEach((f) => f()));

function run({ event = "pull_request", edit = null, issues = [] } = {}) {
  const h = createHarness({ repos: { [HOME]: { issues } } });
  const cwd = mkdtempSync(join(tmpdir(), "drift-home-"));
  cleanups.push(() => h.cleanup(), () => rmSync(cwd, { recursive: true, force: true }));
  cpSync(join(fixtures, "goal-steward-home"), cwd, { recursive: true });
  if (edit) {
    const p = join(cwd, edit.path);
    writeFileSync(p, readFileSync(p, "utf8").replace(edit.from, edit.to));
  }
  const r = h.run(process.execPath, [script, "--source", join(fixtures, "goal-agent-043deaa")], {
    cwd, env: { GITHUB_REPOSITORY: HOME, GITHUB_EVENT_NAME: event },
  });
  return { h, r };
}

const caller = { path: ".github/workflows/goal-agent-audit.yml", from: "branches: [main]", to: "branches: [main, dev]" };

test("goal-steward-home as it stands passes and writes nothing", () => {
  for (const event of ["pull_request", "push"]) {
    const { h, r } = run({ event });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(h.writes.all.length, 0);
  }
});

test("on a PR, drift fails the run with every differing line, and writes nothing", () => {
  const { h, r } = run({ edit: caller });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /caller: \.github\/workflows\/goal-agent-audit\.yml:\d+: found "    branches: \[main, dev\]"/);
  assert.match(r.stderr, /caller: \.github\/workflows\/goal-agent-audit\.yml:\d+: expected "    branches: \[main\]"/);
  assert.equal(h.writes.all.length, 0);
});

test("on a push to main, drift also opens one issue, and no second while it is open", () => {
  const { h, r } = run({ event: "push", edit: caller });
  assert.equal(r.code, 1);
  assert.equal(h.writes.newIssues.length, 1);
  assert.ok(h.writes.newIssues[0].body.startsWith(DRIFT_MARKER));
  assert.match(h.writes.newIssues[0].body, /branches: \[main, dev\]/);
  const again = run({ event: "push", edit: caller, issues: [{ number: 9, title: "drift", body: `${DRIFT_MARKER}\nold` }] });
  assert.equal(again.r.code, 1);
  assert.equal(again.h.writes.all.length, 0);
});
