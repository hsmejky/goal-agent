import { test, after } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHarness } from "../harness/index.mjs";
import { secretName, credentialsFor } from "../../scripts/gate/fire.mjs";

const gate = join(dirname(fileURLToPath(import.meta.url)), "../../scripts/gate/gate.mjs");
const REPO = "me/cov";
const SHA = "a".repeat(40);
const NEW = "c".repeat(40);
const PR_URL = `https://github.com/${REPO}/pull/10`;
const issues = [{ number: 1, labels: ["goal-agent:alpha"] }, { number: 2, labels: ["goal-agent:beta-two"] }];
const secrets = (...names) =>
  JSON.stringify(Object.fromEntries(names.flatMap((n) => [[secretName(n, "FIRE_TOKEN"), `tok-${n}`], [secretName(n, "TRIGGER_ID"), `trig_${n.replace(/-/g, "")}`]])));
const marker = (name, sha) => ({ body: `<!-- goal-agent-review:${name} sha=${sha} verdict=pass -->\nbody`, author_association: "OWNER" });
const triggerOf = (f) => f.url.split("/").at(-2);

const harnesses = [];
after(() => harnesses.forEach((h) => h.cleanup()));

function setup({ body = "Closes #1", draft = false, sha = SHA, comments = [], statuses = {}, curl } = {}) {
  const h = createHarness({
    repos: { [REPO]: { issues: [...issues, { number: 10, title: "PR", comments }], pulls: [{ number: 10, head_sha: sha, body, draft }], statuses } },
    curl,
  });
  harnesses.push(h);
  return h;
}

function run(h, { event = "pull_request_target", sec = secrets("alpha", "beta-two") } = {}) {
  const payload = event === "issue_comment" ? { issue: { number: 10, pull_request: {} } } : { pull_request: { number: 10, head: { sha: SHA } } };
  const eventPath = h.writeScript("event.json", JSON.stringify(payload));
  const env = { GITHUB_REPOSITORY: REPO, GITHUB_EVENT_NAME: event, GITHUB_EVENT_PATH: eventPath };
  if (sec !== null) env.GOAL_AGENT_SECRETS = sec;
  return h.run(process.execPath, [gate], { env });
}

test("secret-name mapping: upper-cased, - becomes _", () => {
  assert.equal(secretName("alpha"), "GOAL_AGENT_ALPHA_FIRE_TOKEN");
  assert.equal(secretName("plugin-maintainer"), "GOAL_AGENT_PLUGIN_MAINTAINER_FIRE_TOKEN");
  assert.equal(secretName("a-b-c1", "TRIGGER_ID"), "GOAL_AGENT_A_B_C1_TRIGGER_ID");
  const secrets = { GOAL_AGENT_PLUGIN_MAINTAINER_FIRE_TOKEN: "t", GOAL_AGENT_PLUGIN_MAINTAINER_TRIGGER_ID: "id1" };
  assert.deepEqual(credentialsFor("plugin-maintainer", secrets), { token: "t", triggerId: "id1" });
  assert.equal(credentialsFor("alpha", { GOAL_AGENT_ALPHA_FIRE_TOKEN: "t" }), null);
});

test("a missing review fires the agent once with the PR URL; the pending description lists it", () => {
  const h = setup();
  const r = run(h);
  assert.equal(r.code, 0);
  assert.equal(h.fires.length, 1);
  const f = h.fires[0];
  assert.equal(f.method, "POST");
  assert.equal(f.url, "https://api.anthropic.com/v1/claude_code/routines/trig_alpha/fire");
  assert.equal(f.headers.authorization, "Bearer tok-alpha");
  assert.equal(f.headers["anthropic-beta"], "experimental-cc-routine-2026-04-01");
  assert.equal(f.headers["anthropic-version"], "2023-06-01");
  assert.deepEqual(JSON.parse(f.body), { text: PR_URL });
  const st = h.writes.statuses.at(-1);
  assert.equal(st.state, "pending");
  assert.match(st.description, /\| Fired: alpha$/);
});

test("a second event for the same SHA does not re-fire", () => {
  const h = setup();
  run(h);
  run(h);
  run(h, { event: "issue_comment" });
  assert.equal(h.fires.length, 1);
});

test("a new head SHA fires again", () => {
  const first = setup();
  run(first);
  assert.equal(first.fires.length, 1);
  const second = setup({ sha: NEW, statuses: { [SHA]: first.state.repos[REPO].statuses[SHA] } });
  run(second);
  assert.equal(second.fires.length, 1);
});

test("only agents with a missing review are fired", () => {
  const h = setup({ body: "Closes #1, closes #2", comments: [marker("alpha", SHA)] });
  run(h);
  assert.deepEqual(h.fires.map(triggerOf), ["trig_betatwo"]);
  assert.equal(h.fires[0].headers.authorization, "Bearer tok-beta-two");
  assert.match(h.writes.statuses.at(-1).description, /\| Fired: beta-two$/);
});

test("fires accumulate across events: a newly credentialed agent is fired, the first is not again", () => {
  const h = setup({ body: "Closes #1, closes #2" });
  run(h, { sec: secrets("alpha") });
  run(h, { sec: secrets("alpha", "beta-two") });
  assert.deepEqual(h.fires.map(triggerOf), ["trig_alpha", "trig_betatwo"]);
  assert.match(h.writes.statuses.at(-1).description, /\| Fired: alpha, beta-two$/);
});

test("a draft PR gets pending and no fire", () => {
  const h = setup({ draft: true });
  assert.equal(run(h).code, 0);
  assert.equal(h.fires.length, 0);
  assert.equal(h.writes.statuses.at(-1).state, "pending");
});

test("marking a draft ready for review fires", () => {
  const draft = setup({ draft: true });
  run(draft);
  const ready = setup({ statuses: { [SHA]: draft.state.repos[REPO].statuses[SHA] } });
  run(ready);
  assert.equal(ready.fires.length, 1);
});

test("a rejected fire gives an error status, fails the run, and is not recorded as fired", () => {
  const h = setup({ curl: { reject: { status: 400, body: '{"error":"routine_paused"}' } } });
  const r = run(h);
  assert.notEqual(r.code, 0);
  const st = h.writes.statuses.at(-1);
  assert.equal(st.state, "error");
  assert.equal(st.context, "goal-agent-review");
  assert.match(st.description, /alpha/);
  assert.doesNotMatch(st.description, /Fired:/);
  assert.match(r.stderr, /fire rejected/);
  run(h); // not recorded, so the next event tries again
  assert.equal(h.fires.length, 2);
});

test("a transport failure also errors and fails the run", () => {
  const h = setup({ curl: { reject: { exit: 7 } } });
  assert.notEqual(run(h).code, 0);
  assert.equal(h.writes.statuses.at(-1).state, "error");
});

test("an agent without credentials is never fired and never an error", () => {
  const h = setup();
  const cases = [null, "{}", "not json", secrets("beta-two"), JSON.stringify({ GOAL_AGENT_ALPHA_FIRE_TOKEN: "t" }), JSON.stringify({ GOAL_AGENT_ALPHA_TRIGGER_ID: "x" })];
  for (const sec of cases) { const r = run(h, { sec }); assert.equal(r.code, 0, `${sec}: ${r.stderr}`); }
  assert.equal(h.fires.length, 0);
  assert.equal(h.writes.statuses.at(-1).state, "pending");
});

test("statuses posted by anything other than the Actions app are ignored when reading back fired agents", () => {
  const forged = { state: "pending", context: "goal-agent-review", description: "Waiting for Goal review from: alpha | Fired: alpha", creator: { login: "someone" } };
  const h = setup({ statuses: { [SHA]: [forged] } });
  run(h);
  assert.equal(h.fires.length, 1); // the forged record did not suppress the fire
  // a newer forged status does not hide the gate's own record either
  const own = h.state.repos[REPO].statuses[SHA];
  const h2 = setup({ statuses: { [SHA]: [{ ...forged, description: "nothing" }, ...own] } });
  run(h2);
  assert.equal(h2.fires.length, 0);
});

test("a PR closing no agent issue fires nothing", () => {
  const h = setup({ body: "Part of #1" });
  run(h);
  assert.equal(h.fires.length, 0);
});

test("the status description stays within 140 characters with the fired record", () => {
  const h = setup();
  run(h);
  assert.ok(h.writes.statuses.at(-1).description.length <= 140);
});
