import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHarness } from "../harness/index.mjs";

const script = join(dirname(fileURLToPath(import.meta.url)), "../../scripts/home/audit.mjs");
const HOME = "me/home";
const STATE_BODY = "## Order\n- me/cov#1\n\nline three\n";
const harnesses = [];
const dirs = [];
after(() => { harnesses.forEach((h) => h.cleanup()); dirs.forEach((d) => rmSync(d, { recursive: true, force: true })); });

/** A Home repo checkout with one definition, for the script's working directory. */
function checkout() {
  const d = mkdtempSync(join(tmpdir(), "audit-cwd-"));
  dirs.push(d);
  mkdirSync(join(d, ".claude", "agents"), { recursive: true });
  writeFileSync(join(d, ".claude", "agents", "alpha.md"), "# alpha\n");
  return d;
}

function seed(extra = {}) {
  const h = createHarness({
    repos: {
      [HOME]: {
        issues: [{ number: 5, title: "alpha State", labels: ["goal-agent:state"], body: STATE_BODY }, ...(extra.issues ?? [])],
        pulls: [{ number: 3, head_sha: "m1", state: "closed", merged: true }, { number: 4, head_sha: "o1", state: "open", merged: false }],
        commits: extra.commits ?? [],
      },
    },
  });
  harnesses.push(h);
  return h;
}

function push(h, commits) {
  const eventPath = h.writeScript("push.json", JSON.stringify({ ref: "refs/heads/main", commits: commits.map((id) => ({ id, message: `msg of ${id}\nbody` })) }));
  return h.run(process.execPath, [script], { cwd: checkout(), env: { GITHUB_REPOSITORY: HOME, GITHUB_EVENT_PATH: eventPath } });
}

const quiet = (h) => { assert.equal(h.writes.all.length, 0); };

test("a commit from a merged PR passes", () => {
  const h = seed({ commits: [{ sha: "c1", pulls: [3], files: ["docs/x.md"] }] });
  assert.equal(push(h, ["c1"]).code, 0);
  quiet(h);
});

test("a memory-only direct push passes", () => {
  const h = seed({ commits: [{ sha: "c1", pulls: [], files: ["memory/a.md", "memory/sub/b.md"] }] });
  assert.equal(push(h, ["c1"]).code, 0);
  quiet(h);
});

test("a commit whose only PR is unmerged is an offence", () => {
  const h = seed({ commits: [{ sha: "c1", pulls: [4], files: ["docs/x.md"] }] });
  push(h, ["c1"]);
  assert.equal(h.writes.newIssues.length, 1);
});

test("a direct non-memory commit sets the marker, keeps the body, and opens one issue listing it", () => {
  const h = seed({ commits: [{ sha: "bad1234567890", pulls: [], files: ["memory/a.md", ".claude/agents/alpha.md"] }, { sha: "ok1", pulls: [3], files: ["x"] }] });
  const r = push(h, ["bad1234567890", "ok1"]);
  assert.equal(r.code, 0, r.stderr);
  const body = h.state.repos[HOME].issues[5].body;
  assert.ok(body.startsWith(STATE_BODY), "every original line is kept");
  assert.match(body.slice(STATE_BODY.length), /^<!-- goal-agent:halted/m);
  assert.equal(h.writes.issueEdits.length, 1);
  assert.equal(h.writes.newIssues.length, 1);
  assert.match(h.writes.newIssues[0].body, /bad123456789/);
  assert.match(h.writes.newIssues[0].body, /msg of bad1234567890/);
  assert.doesNotMatch(h.writes.newIssues[0].body, /ok1/);
});

test("a second offence while the audit issue is open comments instead of opening another", () => {
  const h = seed({ commits: [{ sha: "bad1", pulls: [], files: ["x"] }, { sha: "bad2", pulls: [], files: ["y"] }] });
  push(h, ["bad1"]);
  push(h, ["bad2"]);
  assert.equal(h.writes.newIssues.length, 1);
  assert.equal(h.writes.comments.length, 1);
  assert.match(h.writes.comments[0].body, /bad2/);
  assert.equal(h.writes.issueEdits.length, 1, "marker already set, not rewritten");
});

test("after the audit issue is closed a new offence opens a new one", () => {
  const h = seed({ commits: [{ sha: "bad1", pulls: [], files: ["x"] }, { sha: "bad2", pulls: [], files: ["y"] }] });
  push(h, ["bad1"]);
  const n = h.writes.newIssues.length && Object.keys(h.state.repos[HOME].issues).map(Number).sort().at(-1);
  const state = h.state;
  assert.ok(n > 5, "audit issue exists");
  state.repos[HOME].issues[n].state = "closed";
  writeFileSync(join(h.dir, "state.json"), JSON.stringify(state));
  push(h, ["bad2"]);
  assert.equal(h.writes.newIssues.length, 2);
});
