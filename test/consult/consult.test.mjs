import { test, after } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHarness } from "../harness/index.mjs";
import { secretName } from "../../scripts/gate/fire.mjs";

const script = join(dirname(fileURLToPath(import.meta.url)), "../../scripts/gate/consult.mjs");
const REPO = "me/cov";
const URL = `https://github.com/${REPO}/issues/5#issuecomment-99`;
const secrets = (...names) =>
  JSON.stringify(Object.fromEntries(names.flatMap((n) => [[secretName(n, "FIRE_TOKEN"), `tok-${n}`], [secretName(n, "TRIGGER_ID"), `trig_${n.replace(/-/g, "")}`]])));

const harnesses = [];
after(() => harnesses.forEach((h) => h.cleanup()));

function run({ body = "> *Question for alpha Goal agent.*\n\n1. Is this in scope?", assoc = "COLLABORATOR", pr = false, sec = secrets("alpha"), curl, name = "issue_comment" } = {}) {
  const h = createHarness({ repos: { [REPO]: { issues: [{ number: 5, title: "I" }] } }, curl });
  harnesses.push(h);
  const payload = { action: "created", issue: { number: 5, ...(pr ? { pull_request: {} } : {}) }, comment: { html_url: URL, body, author_association: assoc } };
  const env = { GITHUB_REPOSITORY: REPO, GITHUB_EVENT_NAME: name, GITHUB_EVENT_PATH: h.writeScript("event.json", JSON.stringify(payload)), GOAL_AGENT_SECRETS: sec };
  const r = h.run(process.execPath, [script], { env });
  return { h, r };
}

test("a collaborator's question fires the named agent once with the comment URL", () => {
  const { h, r } = run();
  assert.equal(r.code, 0);
  assert.equal(h.fires.length, 1);
  assert.equal(h.fires[0].url, "https://api.anthropic.com/v1/claude_code/routines/trig_alpha/fire");
  assert.equal(h.fires[0].headers.authorization, "Bearer tok-alpha");
  assert.deepEqual(JSON.parse(h.fires[0].body), { text: URL });
  assert.equal(h.writes.all.length, 0);
});

test("owner and member questions fire too; a hyphenated name maps to its secrets", () => {
  for (const assoc of ["OWNER", "MEMBER"]) assert.equal(run({ assoc }).h.fires.length, 1);
  const { h } = run({ body: "> *Question for plugin-maintainer Goal agent.*\nq", sec: secrets("plugin-maintainer") });
  assert.equal(h.fires[0].url.split("/").at(-2), "trig_pluginmaintainer");
});

test("nothing fires for an outsider, a PR comment, an unknown or uncredentialed name, the agent's own answer or a non-marker comment", () => {
  const cases = {
    outsider: { assoc: "NONE" },
    contributor: { assoc: "CONTRIBUTOR" },
    pr: { pr: true },
    unknown: { body: "> *Question for ghost Goal agent.*\nq" },
    uncredentialed: { sec: secrets("beta") },
    noSecrets: { sec: "{}" },
    badSecrets: { sec: "not json" },
    ownAnswer: { body: "<!-- goal-agent:alpha -->\nAnswer to the question.\n> *Question for alpha Goal agent.*", assoc: "OWNER" },
    notOpening: { body: "see this\n> *Question for alpha Goal agent.*" },
    badName: { body: "> *Question for Al_pha Goal agent.*\nq" },
    wrongEvent: { name: "issues" },
  };
  for (const [label, opts] of Object.entries(cases)) {
    const { h, r } = run(opts);
    assert.equal(r.code, 0, label);
    assert.equal(h.fires.length, 0, label);
  }
});

test("a rejected fire fails the run", () => {
  const { h, r } = run({ curl: { reject: { status: 400, body: "routine_paused" } } });
  assert.equal(h.fires.length, 1);
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /fire rejected/);
});
