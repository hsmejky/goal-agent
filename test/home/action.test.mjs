import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// The same-commit test (ADR 0008): each action runs goal-agent's scripts only from github.action_path,
// the checkout of the commit the caller's `uses:` names, and checks out nothing of goal-agent.
const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const load = (f) => readFileSync(join(root, f), "utf8").replace(/^\s*#.*$/gm, "");

const units = [
  { dir: "home-audit", script: "audit.mjs" },
  { dir: "home-staleness", script: "staleness.mjs" },
];

for (const { dir, script } of units) {
  const text = load(`.github/actions/${dir}/action.yml`);

  test(`${dir}: a composite action`, () => {
    assert.match(text, /^runs:\s*\n\s+using: composite/m);
  });

  test(`${dir}: runs scripts/home/${script} from github.action_path, the commit the caller pinned`, () => {
    const runs = [...text.matchAll(/^\s*run:\s*(.+)$/gm)].map((m) => m[1]);
    assert.equal(runs.length, 1);
    assert.match(runs[0], new RegExp(`node "\\$\\{\\{ github\\.action_path \\}\\}/\\.\\./\\.\\./\\.\\./scripts/home/${script.replace(".", "\\.")}"`));
  });

  test(`${dir}: no step runs a script from a relative path or the workspace`, () => {
    assert.doesNotMatch(text, /node (?!"\$\{\{ github\.action_path)/);
    assert.doesNotMatch(text, /github\.workspace|GITHUB_WORKSPACE/);
  });

  test(`${dir}: checks out only the caller repo's default branch, without credentials, and never goal-agent`, () => {
    const checkouts = text.split(/(?=^\s*- )/m).filter((s) => /uses: actions\/checkout@/.test(s));
    assert.equal(checkouts.length, 1);
    assert.match(checkouts[0], /actions\/checkout@[0-9a-f]{40}/);
    assert.match(checkouts[0], /persist-credentials: false/);
    assert.match(checkouts[0], /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/);
    assert.doesNotMatch(text, /repository:/);
    assert.doesNotMatch(text, /hsmejky\/goal-agent/);
  });

  test(`${dir}: every third-party action is pinned by full SHA`, () => {
    for (const m of text.matchAll(/uses:\s*(\S+)/g)) assert.match(m[1], /@[0-9a-f]{40}$/, m[1]);
  });

  test(`${dir}: no secrets and no inputs; the token is the caller's GITHUB_TOKEN`, () => {
    assert.doesNotMatch(text, /secrets\b|toJSON/);
    assert.doesNotMatch(text, /^inputs:/m);
    assert.match(text, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  });

  test(`${dir}: the script step runs in bash`, () => {
    assert.match(text, /shell: bash/);
  });
}
