// The same-commit property of the goal-agent composite actions (ADR 0008): GitHub downloads the action's
// repository at the caller's `uses:` SHA, so an action that runs its scripts only from `github.action_path`
// and never checks out or fetches goal-agent cannot run scripts from any other commit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "../..");
const actionsDir = join(repo, ".github/actions");
const actions = existsSync(actionsDir) ? readdirSync(actionsDir).filter((d) => existsSync(join(actionsDir, d, "action.yml"))) : [];
const code = (name) => readFileSync(join(actionsDir, name, "action.yml"), "utf8").replace(/\r\n/g, "\n").replace(/^\s*#.*$/gm, "");
const runLines = (text) => [...text.matchAll(/^\s*run: (.*)$/gm)].map((m) => m[1]);

test("the gate and the Consultation are composite actions", () => {
  for (const name of ["gate", "consult"]) {
    assert.ok(actions.includes(name), `.github/actions/${name}/action.yml exists`);
    assert.match(code(name), /runs:\s*\n\s*using: composite/);
  }
});

for (const name of actions) {
  test(`${name}: every script it runs is a node script under github.action_path that exists at this commit`, () => {
    const runs = runLines(code(name));
    assert.ok(runs.length > 0);
    for (const line of runs) {
      const m = /^node "\$\{\{ github\.action_path \}\}\/([^"$]+)"$/.exec(line);
      assert.ok(m, `run line must be node "\${{ github.action_path }}/<script>": ${line}`);
      const script = resolve(actionsDir, name, m[1]);
      assert.ok(script.startsWith(join(repo, "scripts")), `${m[1]} resolves into scripts/`);
      assert.ok(existsSync(script), `${m[1]} exists`);
    }
  });

  test(`${name}: no step checks out or fetches goal-agent, and every action it uses is pinned by full SHA`, () => {
    const text = code(name);
    assert.doesNotMatch(text, /repository:/);
    assert.doesNotMatch(text, /\bref:/);
    assert.doesNotMatch(text, /\b(git|curl|wget|gh) /);
    for (const [, ref] of text.matchAll(/^\s*(?:- )?uses: (\S+)/gm)) {
      assert.match(ref, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
      assert.doesNotMatch(ref, /^hsmejky\/goal-agent[/@]/);
    }
  });

  test(`${name}: the caller repo checkout keeps no credentials and takes nothing from the PR`, () => {
    const text = code(name);
    for (const [step] of text.matchAll(/uses: actions\/checkout@[^\n]*(\n\s+with:(\n\s{8,}.*)*)?/g)) {
      assert.match(step, /persist-credentials: false/);
    }
    assert.doesNotMatch(text, /github\.event\.pull_request\.head/);
    assert.doesNotMatch(text, /toJSON|secrets\./);
  });
}
