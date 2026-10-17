// Tests for the harness itself. Scripts under test here are tiny node programs that call
// `gh`/`curl` through a shell, which resolves the fake shims on Linux (sh) and Windows (cmd).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHarness } from "./index.mjs";

const b64 = (s) => Buffer.from(s).toString("base64");

const SHELL = `const {spawnSync}=require("node:child_process");
const sh=(c,o={})=>{const r=spawnSync(c,{shell:true,encoding:"utf8",...o});process.stdout.write(r.stdout);process.stderr.write(r.stderr);if(r.status)process.exitCode=r.status;};`;

test("a script reads seeded issues through gh api and the run reports its output", () => {
  const h = createHarness({ repos: { "o/r": { issues: [{ number: 7, title: "Hello", labels: ["bug"] }] } } });
  const script = h.writeScript("read.cjs", `${SHELL} sh("gh api repos/o/r/issues/7");`);
  const r = h.run(process.execPath, [script]);
  assert.equal(r.code, 0, r.stderr);
  const issue = JSON.parse(r.stdout);
  assert.equal(issue.title, "Hello");
  assert.deepEqual(issue.labels.map((l) => l.name), ["bug"]);
  h.cleanup();
});

test("writes are recorded by kind: statuses, comments, issue edits, new issues, labels", () => {
  const h = createHarness({ repos: { "o/r": { issues: [{ number: 1, title: "t" }] } } });
  const script = h.writeScript("write.cjs", `${SHELL}
sh("gh api repos/o/r/statuses/abc123 -f state=success -f context=goal-review -f description=ok");
sh("gh api repos/o/r/issues/1/comments -f body=hi");
sh("gh api -X PATCH repos/o/r/issues/1 -f state=closed");
sh("gh api repos/o/r/issues -f title=New -f body=B");
sh("gh api repos/o/r/issues/1/labels -f labels[]=x -f labels[]=y");`);
  const r = h.run(process.execPath, [script]);
  assert.equal(r.code, 0, r.stderr);
  const w = h.writes;
  assert.deepEqual(w.statuses, [{ repo: "o/r", sha: "abc123", state: "success", context: "goal-review", description: "ok" }]);
  assert.deepEqual(w.comments, [{ repo: "o/r", issue: 1, body: "hi" }]);
  assert.deepEqual(w.issueEdits, [{ repo: "o/r", issue: 1, changes: { state: "closed" } }]);
  assert.equal(w.newIssues.length, 1);
  assert.equal(w.newIssues[0].title, "New");
  assert.deepEqual(w.labels, [{ repo: "o/r", issue: 1, action: "add", labels: ["x", "y"] }]);
  assert.equal(h.state.repos["o/r"].issues[1].state, "closed");
  assert.deepEqual(h.state.repos["o/r"].issues[1].labels, ["x", "y"]);
  h.cleanup();
});

test("combined status and commit-to-PR lookups reflect seeded and written data", () => {
  const h = createHarness({ repos: { "o/r": { pulls: [{ number: 3, head_sha: "s1" }], commits: [{ sha: "s1", pulls: [3] }] } } });
  const script = h.writeScript("q.cjs", `${SHELL}
sh("gh api repos/o/r/commits/s1/pulls");
sh("gh api repos/o/r/statuses/s1 -f state=failure -f context=c");
sh("gh api repos/o/r/commits/s1/status");`);
  const r = h.run(process.execPath, [script]);
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /"number":\s*3/);
  assert.match(r.stdout, /"state":\s*"failure"/);
  h.cleanup();
});

for (const cmd of ["gh issue list", "gh api graphql -f query=x", "gh pr view 3", "gh api repos/o/r/issues --jq .[]"]) {
  test(`unsupported gh call fails the run with a clear message: ${cmd}`, () => {
    const h = createHarness({ repos: { "o/r": {} } });
    const script = h.writeScript("bad.cjs", `${SHELL} sh(${JSON.stringify(cmd)});`);
    assert.throws(() => h.run(process.execPath, [script]), /fake gh:/);
    assert.equal(h.violations.length, 1);
    h.cleanup();
  });
}

test("a violation can be inspected without throwing when allowViolations is set", () => {
  const h = createHarness({ repos: { "o/r": {} } });
  const script = h.writeScript("bad.cjs", `${SHELL} sh("gh issue list");`);
  const r = h.run(process.execPath, [script], { allowViolations: true });
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /fake gh/);
  h.cleanup();
});

test("missing resources return a real-looking 404 and are not violations", () => {
  const h = createHarness({ repos: { "o/r": {} } });
  const script = h.writeScript("nf.cjs", `${SHELL} sh("gh api repos/o/r/issues/99");`);
  const r = h.run(process.execPath, [script]);
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /404/);
  h.cleanup();
});

test("curl records method, url, headers and body of each fire", () => {
  const h = createHarness({});
  const script = h.writeScript("fire.cjs", `${SHELL}
sh('curl -sS -X POST https://example.test/fire -H "Authorization: Bearer tok" -H "Content-Type: application/json" -d @-',{input:'{"text":"go"}'});`);
  const r = h.run(process.execPath, [script]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(h.fires.length, 1);
  const f = h.fires[0];
  assert.equal(f.method, "POST");
  assert.equal(f.url, "https://example.test/fire");
  assert.equal(f.headers["authorization"], "Bearer tok");
  assert.equal(f.headers["content-type"], "application/json");
  assert.equal(f.body, '{"text":"go"}');
  h.cleanup();
});

test("curl can be told to reject, and --fail turns the rejection into exit 22", () => {
  const h = createHarness({ curl: { reject: { status: 403, body: "nope" } } });
  const script = h.writeScript("rej.cjs", `${SHELL} sh("curl -sS --fail -X POST https://example.test/fire -d x");`);
  const r = h.run(process.execPath, [script]);
  assert.equal(r.code, 22);
  assert.equal(h.fires.length, 1, "a rejected fire is still recorded");
  assert.equal(h.fires[0].responded, 403);
  h.cleanup();
});

test("curl rejection without --fail prints the body and the status for -w", () => {
  const h = createHarness({ curl: { reject: { status: 500, body: "boom" } } });
  const script = h.writeScript("rej2.cjs", `${SHELL} sh("curl -s -o /dev/null -w %{http_code} https://example.test/x");`);
  const r = h.run(process.execPath, [script]);
  assert.equal(r.stdout.trim(), "500");
  h.cleanup();
});

test("curl reads the body from stdin with -d @-", () => {
  const h = createHarness({});
  const script = h.writeScript("stdin.cjs", `${SHELL} sh("curl -s -X POST https://example.test/f -d @-",{input:"from-stdin"});`);
  h.run(process.execPath, [script]);
  assert.equal(h.fires[0].body, "from-stdin");
  h.cleanup();
});

test("run returns the exit status of a child that exits without reading a large input", () => {
  const h = createHarness({ repos: {} });
  const r = h.run("bash", ["-c", "exit 0"], { input: "x".repeat(1024 * 1024) });
  assert.equal(r.code, 0);
  h.cleanup();
});

test("compare answers a seeded status per head and 404s an unknown one; POST pulls records a new PR", () => {
  const h = createHarness({ repos: { "o/r": { compare: { "main...aaa": "behind" } } } });
  const script = h.writeScript("c.cjs", `${SHELL}
sh("gh api repos/o/r/compare/main...aaa");
sh("gh api repos/o/r/compare/main...bbb || echo bbb-refused");
sh("gh api repos/o/r/pulls -f title=T -f head=br -f base=main -f body=B");`);
  const r = h.run(process.execPath, [script]);
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /"status":\s*"behind"/);
  assert.deepEqual(h.writes.newPulls.map(({ repo, title, head, base, body }) => ({ repo, title, head, base, body })), [{ repo: "o/r", title: "T", head: "br", base: "main", body: "B" }]);
  h.cleanup();
});

test("contents at a ref answers seeded text base64-encoded and 404s a missing file or ref", () => {
  const h = createHarness({ repos: { "o/r": { files: { "a.md": "default" }, refFiles: { abc: { "a.md": "at abc" } } } } });
  const script = h.writeScript("ct.cjs", `${SHELL}
sh("gh api repos/o/r/contents/a.md?ref=abc");
sh("gh api repos/o/r/contents/a.md");
sh("gh api repos/o/r/contents/missing.md?ref=abc || echo missing-refused");
sh("gh api repos/o/r/contents/a.md?ref=zzz || echo ref-refused");`);
  const r = h.run(process.execPath, [script]);
  assert.equal(r.code, 0, r.stderr);
  const lines = r.stdout.trim().split("\n");
  assert.equal(JSON.parse(lines[0]).content, b64("at abc"));
  assert.equal(JSON.parse(lines[1]).content, b64("default"));
  assert.match(r.stdout, /missing-refused/);
  assert.match(r.stdout, /ref-refused/);
  h.cleanup();
});

test("contents at a ref 404s when the repo seeds no refFiles at all; without a ref it serves files", () => {
  const h = createHarness({ repos: { "o/r": { files: { "a.md": "default" } } } });
  const script = h.writeScript("ct2.cjs", `${SHELL}
sh("gh api repos/o/r/contents/a.md");
sh("gh api repos/o/r/contents/a.md?ref=abc || echo ref-refused");`);
  const r = h.run(process.execPath, [script]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout.split("\n")[0]).content, b64("default"));
  assert.match(r.stdout, /ref-refused/);
  h.cleanup();
});

test("pulls list filters by head branch and state; an empty repo lists nothing", () => {
  const h = createHarness({ repos: {
    "o/r": { pulls: [{ number: 1, head_ref: "pin/aaa" }, { number: 2, head_ref: "pin/aaa", state: "closed" }, { number: 3, head_ref: "other" }] },
    "o/empty": {},
  } });
  const script = h.writeScript("pl.cjs", `${SHELL}
sh("gh api repos/o/r/pulls?head=o:pin/aaa");
sh('gh api "repos/o/r/pulls?head=o:pin/aaa&state=all"');
sh("gh api repos/o/r/pulls?head=o:pin/none");
sh("gh api repos/o/empty/pulls?head=o:pin/aaa");`);
  const r = h.run(process.execPath, [script]);
  assert.equal(r.code, 0, r.stderr);
  const [open, all, none, empty] = r.stdout.trim().split("\n").map((l) => JSON.parse(l));
  assert.deepEqual(open.map((p) => p.number), [1]);
  assert.deepEqual(all.map((p) => p.number), [1, 2]);
  assert.deepEqual(none, []);
  assert.deepEqual(empty, []);
  h.cleanup();
});

test("pulls head filter needs owner and branch: a bare branch or another owner matches nothing", () => {
  const h = createHarness({ repos: { "o/r": { pulls: [{ number: 1, head_ref: "pin/aaa" }, { number: 2, head_ref: "pin/aaa", head_owner: "fork" }] } } });
  const script = h.writeScript("hd.cjs", `${SHELL}
sh("gh api repos/o/r/pulls?head=o:pin/aaa");
sh("gh api repos/o/r/pulls?head=fork:pin/aaa");
sh("gh api repos/o/r/pulls?head=pin/aaa");
sh("gh api repos/o/r/pulls?head=nobody:pin/aaa");`);
  const r = h.run(process.execPath, [script]);
  assert.equal(r.code, 0, r.stderr);
  const [own, fork, bare, other] = r.stdout.trim().split("\n").map((l) => JSON.parse(l).map((p) => p.number));
  assert.deepEqual(own, [1]);
  assert.deepEqual(fork, [2]);
  assert.deepEqual(bare, []);
  assert.deepEqual(other, []);
  h.cleanup();
});

test("closing a pull request is recorded as a write and shows in the state", () => {
  const h = createHarness({ repos: { "o/r": { pulls: [{ number: 4, head_ref: "pin/aaa" }] } } });
  const script = h.writeScript("cl.cjs", `${SHELL}
sh("gh api -X PATCH repos/o/r/pulls/4 -f state=closed");
sh("gh api -X PATCH repos/o/r/pulls/99 -f state=closed || echo nf");`);
  const r = h.run(process.execPath, [script]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(h.state.repos["o/r"].pulls[4].state, "closed");
  assert.deepEqual(h.writes.closedPulls, [{ repo: "o/r", number: 4 }]);
  assert.deepEqual(h.writes.all.map((w) => w.kind), ["pull-close"]);
  h.cleanup();
});

test("patching a pull request applies only state, title and body; closing twice records one close", () => {
  const h = createHarness({ repos: { "o/r": { pulls: [{ number: 4, head_ref: "pin/aaa", title: "old" }] } } });
  const script = h.writeScript("pp.cjs", `${SHELL}
sh("gh api -X PATCH repos/o/r/pulls/4 -f state=closed -f title=new -f merged=true -f number=99 -f base=evil");
sh("gh api -X PATCH repos/o/r/pulls/4 -f state=closed");`);
  const r = h.run(process.execPath, [script]);
  assert.equal(r.code, 0, r.stderr);
  const pr = h.state.repos["o/r"].pulls[4];
  assert.equal(pr.state, "closed");
  assert.equal(pr.title, "new");
  assert.equal(pr.merged, false);
  assert.equal(pr.number, 4);
  assert.equal(pr.base, undefined);
  assert.deepEqual(h.writes.closedPulls, [{ repo: "o/r", number: 4 }]);
  h.cleanup();
});

test("secret names are listed without values; labels list; unseeded lists are empty", () => {
  const h = createHarness({ repos: {
    "o/r": { secrets: [{ name: "TOKEN_A", value: "s3cret-value" }, "TOKEN_B"], labels: ["goal-agent:x", { name: "bug" }] },
    "o/none": {},
  } });
  const script = h.writeScript("sl.cjs", `${SHELL}
sh("gh api repos/o/r/actions/secrets");
sh("gh api repos/o/r/labels");
sh("gh api repos/o/none/actions/secrets");
sh("gh api repos/o/none/labels");`);
  const r = h.run(process.execPath, [script]);
  assert.equal(r.code, 0, r.stderr);
  assert.ok(!r.stdout.includes("s3cret-value"), "no secret value leaves the fake");
  const [secrets, labels, noSecrets, noLabels] = r.stdout.trim().split("\n").map((l) => JSON.parse(l));
  assert.deepEqual(secrets.secrets.map((s) => s.name), ["TOKEN_A", "TOKEN_B"]);
  assert.equal(secrets.total_count, 2);
  assert.deepEqual(labels.map((l) => l.name), ["goal-agent:x", "bug"]);
  assert.deepEqual(noSecrets, { total_count: 0, secrets: [] });
  assert.deepEqual(noLabels, []);
  h.cleanup();
});

test("repo Actions policies list as the real API does when seeded and are an empty list otherwise", () => {
  const policy = {
    name: "goal-agent-review events", target: "actions", source_type: "Repository", source: "o/r", enforcement: "active",
    conditions: { workflow_path: { include: [".github/workflows/goal-agent-review.yml"], exclude: [] } },
    rules: [{ type: "restrict_action_events", parameters: { allowed_events: ["pull_request_target", "issue_comment", "issues"] } }],
  };
  const h = createHarness({ repos: { "o/r": { actionsPolicies: [policy] }, "o/none": {} } });
  const script = h.writeScript("ap.cjs", `${SHELL}
sh("gh api repos/o/r/actions/policies");
sh("gh api repos/o/none/actions/policies");
sh("gh api repos/o/r/actions/workflows/goal-agent-review.yml/event-policy");`);
  const r = h.run(process.execPath, [script], { allowViolations: true });
  const [list, none] = r.stdout.trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(list.total_count, 1);
  assert.equal(typeof list.policies[0].id, "number");
  assert.deepEqual({ ...list.policies[0], id: undefined }, { ...policy, id: undefined });
  assert.deepEqual(none, { total_count: 0, policies: [] });
  assert.equal(h.violations.length, 1, "the per-workflow path is not a real route");
  h.cleanup();
});

// Prints: no-token | no-header (no X-Oauth-Scopes, as a fine-grained token) | empty | workflow | plain
const TOKEN_PROBE = `${SHELL}
const token = spawnSync("gh auth token", { shell: true, encoding: "utf8" });
if (token.status) {
  console.log("no-token");
} else {
  const user = spawnSync("gh api -i user", { shell: true, encoding: "utf8" });
  const header = /^x-oauth-scopes:[ \t]*(.*)$/im.exec(user.stdout);
  if (!header) console.log("no-header");
  else {
    const scopes = header[1].split(",").map((s) => s.trim()).filter(Boolean);
    console.log(scopes.length === 0 ? "empty" : scopes.includes("workflow") ? "workflow" : "plain");
  }
}`;

for (const [label, seed, want] of [
  ["with the workflow scope", { token: { value: "tok-1", scopes: ["repo", "workflow"] } }, "workflow"],
  ["without the workflow scope", { token: { value: "tok-2", scopes: ["repo"] } }, "plain"],
  ["with an empty scope list", { token: { value: "tok-3", scopes: [] } }, "empty"],
  ["with no scopes header (fine-grained)", { token: { value: "tok-4" } }, "no-header"],
  ["absent", {}, "no-token"],
]) {
  test(`a script tells a seeded token ${label} apart through gh auth token and gh api -i user`, () => {
    const h = createHarness(seed);
    const r = h.run(process.execPath, [h.writeScript("tok.cjs", TOKEN_PROBE)]);
    assert.equal(r.stdout.trim(), want, r.stderr);
    h.cleanup();
  });
}

test("gh auth token prints the seeded token; other gh auth calls are still refused", () => {
  const h = createHarness({ token: { value: "tok-1", scopes: [] } });
  const r = h.run(process.execPath, [h.writeScript("t.cjs", `${SHELL} sh("gh auth token"); sh("gh auth login");`)], { allowViolations: true });
  assert.equal(r.stdout.trim(), "tok-1");
  assert.equal(h.violations.length, 1);
  h.cleanup();
});
