// The same-commit property of the goal-agent composite actions (ADR 0008): GitHub downloads the action's
// repository at the caller's `uses:` SHA, so an action that runs its scripts only from `github.action_path`
// and never checks out or fetches goal-agent cannot run scripts from any other commit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "../..");
const actionsDir = join(repo, ".github/actions");
const dirs = existsSync(actionsDir) ? readdirSync(actionsDir).filter((d) => existsSync(join(actionsDir, d, "action.yml"))) : [];
const code = (name) => readFileSync(join(actionsDir, name, "action.yml"), "utf8").replace(/\r\n/g, "\n").replace(/^\s*#.*$/gm, "");

// Every action under .github/actions, with the one script it runs and the commit of the caller repo it checks
// out: its default branch, or for the drift check alone the commit under check (ADR 0008, amendment).
const units = [
  { dir: "gate", script: "scripts/gate/gate.mjs", token: true, checkout: "default" },
  { dir: "consult", script: "scripts/gate/consult.mjs", token: false, checkout: "default" },
  { dir: "home-audit", script: "scripts/home/audit.mjs", token: true, checkout: "default" },
  { dir: "home-staleness", script: "scripts/home/staleness.mjs", token: true, checkout: "default" },
  { dir: "home-drift-check", script: "scripts/home/drift-check.mjs", token: true, checkout: "event" },
];

test("every action under .github/actions is covered by this table", () => {
  assert.deepEqual([...dirs].sort(), units.map((u) => u.dir).sort());
});

for (const { dir, script, token, checkout } of units) {
  const text = code(dir);

  test(`${dir}: a composite action`, () => {
    assert.match(text, /^runs:\s*\n\s+using: composite/m);
  });

  test(`${dir}: runs ${script} from github.action_path, the commit the caller pinned, in bash`, () => {
    const runs = [...text.matchAll(/^\s*run:\s*(.+)$/gm)].map((m) => m[1]);
    assert.equal(runs.length, 1);
    const m = /^node "\$\{\{ github\.action_path \}\}\/([^"$]+)"$/.exec(runs[0]);
    assert.ok(m, `run line must be node "\${{ github.action_path }}/<script>": ${runs[0]}`);
    const resolved = resolve(actionsDir, dir, m[1]);
    assert.equal(resolved, join(repo, script));
    assert.ok(resolved.startsWith(join(repo, "scripts") + sep), `${m[1]} resolves into scripts/`);
    assert.ok(existsSync(resolved), `${m[1]} exists`);
    const steps = text.split(/(?=^\s*- )/m).filter((s) => /^\s*run:/m.test(s));
    assert.equal(steps.length, 1);
    for (const step of steps) assert.match(step, /^\s*shell: bash$/m, "every run step sets shell: bash");
  });

  test(`${dir}: no step runs a script from a relative path or the workspace`, () => {
    assert.doesNotMatch(text, /node (?!"\$\{\{ github\.action_path)/);
    assert.doesNotMatch(text, /github\.workspace|GITHUB_WORKSPACE/);
    assert.doesNotMatch(text, /\b(git|curl|wget|gh) /);
  });

  const what = checkout === "default" ? "the caller repo's default branch" : "the caller repo's commit under check";
  test(`${dir}: checks out only ${what}, without credentials, and never goal-agent`, () => {
    const checkouts = text.split(/(?=^\s*- )/m).filter((s) => /uses: actions\/checkout@/.test(s));
    assert.equal(checkouts.length, 1);
    assert.match(checkouts[0], /actions\/checkout@[0-9a-f]{40}/);
    assert.match(checkouts[0], /persist-credentials: false/);
    if (checkout === "default") assert.match(checkouts[0], /^\s+ref: \$\{\{ github\.event\.repository\.default_branch \}\}$/m);
    else assert.doesNotMatch(checkouts[0], /^\s+ref:/m, "the event's own commit: the PR merge commit or the pushed one");
    assert.doesNotMatch(text, /repository:/);
    assert.doesNotMatch(text, /hsmejky\/goal-agent/);
    assert.doesNotMatch(text, /github\.event\.pull_request\.head/);
  });

  test(`${dir}: every action it uses is pinned by full SHA`, () => {
    for (const m of text.matchAll(/uses:\s*(\S+)/g)) assert.match(m[1], /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, m[1]);
  });

  test(`${dir}: no secrets and no inputs${token ? "; the token is the caller's GITHUB_TOKEN" : ""}`, () => {
    assert.doesNotMatch(text, /secrets\b|toJSON/);
    assert.doesNotMatch(text, /^inputs:/m);
    if (token) assert.match(text, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  });
}
