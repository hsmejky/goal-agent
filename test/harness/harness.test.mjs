// Tests for the harness itself. Scripts under test here are tiny node programs that call
// `gh`/`curl` through a shell, which resolves the fake shims on Linux (sh) and Windows (cmd).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHarness } from "./index.mjs";

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
