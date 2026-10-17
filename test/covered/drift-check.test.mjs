// The Covered repo drift check (ADR 0011) at its process boundary: a fixture Covered repo as the checkout,
// goal-agent (this checkout) as the source, fake GitHub to show that nothing is read or written.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHarness } from "../harness/index.mjs";
import { COVERED_DRIFT_TEMPLATE, COVERED_DRIFT_WORKFLOW, renderCoveredCaller } from "../../scripts/render/render.mjs";

const repo = join(dirname(fileURLToPath(import.meta.url)), "../..");
const script = join(repo, "scripts/covered/drift-check.mjs");
const PIN = "a".repeat(40);
const OTHER = "b".repeat(40);
const GATE = "goal-agent-review.yml";
const CONSULT = "goal-agent-consult.yml";
const THIRD = COVERED_DRIFT_WORKFLOW;
const templates = { [GATE]: GATE, [CONSULT]: CONSULT, [THIRD]: COVERED_DRIFT_TEMPLATE };

const cleanups = [];
after(() => cleanups.forEach((f) => f()));

/** Every file under `dir` with its text, to show a run changed nothing. */
const snapshot = (dir) => Object.fromEntries(readdirSync(dir, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile()).map((e) => [join(e.parentPath, e.name), readFileSync(join(e.parentPath, e.name), "utf8")]));

/**
 * Run the check on a Covered repo whose registry holds `names` and whose callers are the templates at PIN for
 * those names; `edit(workflow, text)` returns the text of a caller written instead (null: leave the file out).
 */
function run({ names = ["goal-steward"], edit = (_workflow, text) => text, event = "pull_request" } = {}) {
  const h = createHarness({ repos: { "me/covered": {} } });
  const cwd = mkdtempSync(join(tmpdir(), "drift-covered-"));
  cleanups.push(() => h.cleanup(), () => rmSync(cwd, { recursive: true, force: true }));
  mkdirSync(join(cwd, ".github/workflows"), { recursive: true });
  mkdirSync(join(cwd, "docs/agents"), { recursive: true });
  const rows = names.map((n) => `| \`${n}\` | \`goal-agent:${n}\` | \`me/${n}-home\` |`).join("\n");
  writeFileSync(join(cwd, "docs/agents/goal-agents.md"), `| Goal agent | Label | Home repo |\n|---|---|---|\n${rows}\n`);
  for (const [workflow, template] of Object.entries(templates)) {
    const text = edit(workflow, renderCoveredCaller(readFileSync(join(repo, "templates", template), "utf8"), PIN, names));
    if (text !== null) writeFileSync(join(cwd, ".github/workflows", workflow), text);
  }
  const before = snapshot(cwd);
  const r = h.run(process.execPath, [script, "--covered", cwd], { cwd, env: { GITHUB_REPOSITORY: "me/covered", GITHUB_EVENT_NAME: event } });
  return { h, r, unchanged: () => assert.deepEqual(snapshot(cwd), before) };
}

/** The check fails on `edit` (on a PR and on a push), prints a line matching each pattern, and changes nothing. */
function fails(edit, patterns, names) {
  for (const event of ["pull_request", "push"]) {
    const { h, r, unchanged } = run({ edit, names, event });
    assert.equal(r.code, 1, r.stdout + r.stderr);
    for (const p of patterns) assert.match(r.stderr, p);
    assert.equal(h.writes.all.length, 0);
    assert.equal(h.ghCalls.length, 0);
    unchanged();
  }
}

const only = (workflow, change) => (w, text) => (w === workflow ? change(text) : text);

test("a clean Covered repo passes with a clean line, on a PR and on a push, and changes nothing", () => {
  for (const names of [["goal-steward"], ["goal-steward", "other-agent"]]) {
    for (const event of ["pull_request", "push"]) {
      const { h, r, unchanged } = run({ names, event });
      assert.equal(r.code, 0, r.stderr);
      assert.match(r.stdout, /drift check: no drift/);
      assert.equal(h.writes.all.length, 0);
      assert.equal(h.ghCalls.length, 0);
      unchanged();
    }
  }
});

test("one caller at another SHA than the gate's fails with its differing lines", () => {
  fails(only(THIRD, (t) => t.replace(`@${PIN}`, `@${OTHER}`)), [new RegExp(`caller: \\.github/workflows/${THIRD}:\\d+: found .*@${OTHER}`), new RegExp(`caller: \\.github/workflows/${THIRD}:\\d+: expected .*@${PIN}`)]);
  fails(only(CONSULT, (t) => t.replace(`@${PIN}`, `@${OTHER}`)), [new RegExp(`${CONSULT}:\\d+: found .*@${OTHER}`)]);
});

test("an edited caller fails", () => {
  fails(only(CONSULT, (t) => t.replace("runs-on: ubuntu-latest", "runs-on: self-hosted")), [/goal-agent-consult\.yml:\d+: found "    runs-on: self-hosted"/, /goal-agent-consult\.yml:\d+: expected "    runs-on: ubuntu-latest"/]);
});

test("a secret pair missing from a caller fails", () => {
  fails(only(GATE, (t) => t.split("\n").filter((l) => !l.includes("GOAL_AGENT_OTHER_AGENT_")).join("\n")),
    [/goal-agent-review\.yml:\d+: expected ".*GOAL_AGENT_OTHER_AGENT_FIRE_TOKEN/, /goal-agent-review\.yml:\d+: expected ".*GOAL_AGENT_OTHER_AGENT_TRIGGER_ID/], ["goal-steward", "other-agent"]);
});

test("an extra secret pair in a caller fails", () => {
  fails(only(GATE, (t) => t.replace(/^(\s*)GOAL_AGENT_GOAL_STEWARD_TRIGGER_ID:.*$/m, (l, s) => `${l}\n${s}GOAL_AGENT_EXTRA_FIRE_TOKEN: \${{ secrets.GOAL_AGENT_EXTRA_FIRE_TOKEN }}`)),
    [/goal-agent-review\.yml:\d+: found ".*GOAL_AGENT_EXTRA_FIRE_TOKEN/]);
});

test("secret pairs out of the registry's order fail", () => {
  const swap = (t) => {
    const lines = t.split("\n");
    const at = lines.findIndex((l) => l.includes("GOAL_AGENT_GOAL_STEWARD_FIRE_TOKEN"));
    lines.splice(at, 4, ...lines.slice(at + 2, at + 4), ...lines.slice(at, at + 2));
    return lines.join("\n");
  };
  fails(only(CONSULT, swap), [/goal-agent-consult\.yml:\d+/], ["goal-steward", "other-agent"]);
});

test("a missing third caller fails", () => {
  fails((w, t) => (w === THIRD ? null : t), [new RegExp(`caller: \\.github/workflows/${THIRD}: expected "the file"`)]);
});

test("a short SHA in a caller fails", () => {
  fails(only(THIRD, (t) => t.replace(`@${PIN}`, `@${PIN.slice(0, 12)}`)), [new RegExp(`${THIRD}:\\d+: found .*@${PIN.slice(0, 12)}"`)]);
  fails(only(GATE, (t) => t.replace(`@${PIN}`, `@${PIN.slice(0, 12)}`)), [/uses: \.github\/workflows\/goal-agent-review\.yml: expected "a full 40-hex goal-agent SHA"/]);
});
