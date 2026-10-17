// The Pin move (R59, ADR 0011, #149) at its process boundary: the Roster in a fake goal-agent repo, each Home repo
// as a local bare remote the command clones and pushes to (--remotes), the compare check, the Roster and the
// definitions over the fake GitHub, and the user's token behind the fake `gh`. The last test runs the real Home
// repo drift check on a PR branch.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHarness } from "../harness/index.mjs";
import { adoptFiles, fsTree } from "../../scripts/render/render.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const script = join(root, "scripts/home/pin-move.mjs");
const driftCheck = join(root, "scripts/home/drift-check.mjs");
const TARGET = "b".repeat(40);
const SHA12 = TARGET.slice(0, 12);
const BRANCH = `goal-agent-sync-${SHA12}`;
const OLD_PIN = "043deaa1aecf61f6bed469cd68414da1b3cbbf74";
const SECRET = "ghp_secret_token_value";
const A = "hsmejky/goal-steward-home";
const B = "hsmejky/other-home";
const ROSTER_PATH = "docs/home-repos.md";

const cleanups = [];
after(() => cleanups.forEach((f) => f()));

const git = (cwd, ...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.test", "-c", "core.autocrlf=false", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "pin-move-"));
  cleanups.push(() => rmSync(d, { recursive: true, force: true }));
  return d;
};

/** The definition text of a Home repo for `name` (the fixture's goal-steward, renamed). */
const definition = (name) => readFileSync(join(root, "test/fixtures/goal-steward-home/.claude/agents/goal-steward.md"), "utf8").replaceAll("goal-steward", name);

/**
 * A Home repo `repo` for agent `name`, pushed to a bare remote under `remotes/<repo>.git`. Behind the target
 * (the fixture's pin) unless `atTarget`; `rejectPush` makes the remote refuse every push.
 */
function homeRepo(remotes, repo, name, { atTarget = false, rejectPush = false } = {}) {
  const dir = tmp();
  const home = join(dir, "home"), origin = join(remotes, `${repo}.git`);
  cpSync(join(root, "test/fixtures/goal-steward-home"), home, { recursive: true });
  if (name !== "goal-steward") {
    renameSync(join(home, ".claude/agents/goal-steward.md"), join(home, `.claude/agents/${name}.md`));
    writeFileSync(join(home, `.claude/agents/${name}.md`), definition(name));
  }
  if (atTarget) {
    const files = adoptFiles({ source: fsTree(root), home: fsTree(home), name, pin: TARGET, homeRepo: repo });
    for (const [p, text] of Object.entries(files)) {
      if (text === null) { rmSync(join(home, p), { force: true }); continue; }
      mkdirSync(dirname(join(home, p)), { recursive: true });
      writeFileSync(join(home, p), text);
    }
  }
  mkdirSync(dirname(origin), { recursive: true });
  git(dir, "init", "-q", "--bare", "-b", "main", origin);
  git(home, "init", "-q", "-b", "main");
  git(home, "add", "-A");
  git(home, "commit", "-q", "-m", "home");
  git(home, "remote", "add", "origin", origin);
  git(home, "push", "-q", "origin", "main");
  if (rejectPush) {
    mkdirSync(join(origin, "hooks"), { recursive: true });
    writeFileSync(join(origin, "hooks/pre-receive"), "#!/bin/sh\necho 'rejected: no push' >&2\nexit 1\n", { mode: 0o755 });
  }
  return { origin };
}

const table = (...rows) => ["# Home repos", "", "| Goal agent | Home repo |", "|---|---|", ...rows, ""].join("\n");
const row = (name, repo) => `| \`${name}\` | \`${repo}\` |`;

/**
 * One Pin move run. `roster` is the Roster text at goal-agent's main, `homes` the Home repos the fake GitHub knows
 * (with a definition unless `noDefinition`), `token` the seeded token.
 */
function run({ argv = [TARGET], roster = table(row("goal-steward", A), row("other-agent", B)), compare = { [`main...${TARGET}`]: "behind" }, homes = {}, token = { value: SECRET, scopes: ["repo", "workflow"] }, remotes, env = {} } = {}) {
  const repos = { "hsmejky/goal-agent": { compare, refFiles: { main: { [ROSTER_PATH]: roster } } } };
  for (const [repo, { name = "goal-steward", noDefinition = false } = {}] of Object.entries(homes)) repos[repo] = { files: noDefinition ? {} : { [`.claude/agents/${name}.md`]: definition(name) } };
  const h = createHarness({ repos, token });
  cleanups.push(() => h.cleanup());
  const r = h.run(process.execPath, [script, ...argv, "--source", root, "--remotes", remotes ?? tmp()], { env: { GIT_AUTHOR_NAME: "Pin User", GIT_AUTHOR_EMAIL: "pin@example.test", GIT_COMMITTER_NAME: "Pin User", GIT_COMMITTER_EMAIL: "pin@example.test", ...env } });
  return { h, r };
}

const branches = (origin) => git(origin, "branch", "--format=%(refname:short)").split("\n").filter(Boolean).sort();
const reads = (h) => h.ghCalls.filter((c) => c.some((a) => /^repos\//.test(a)));

for (const target of ["abc1234", "B".repeat(40), "main", "", undefined]) {
  test(`a target that is not a full 40-hex SHA is refused before any repo is read: ${JSON.stringify(target)}`, () => {
    const { h, r } = run({ argv: target === undefined ? [] : [target] });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /full 40-hex/);
    assert.equal(reads(h).length, 0);
    assert.equal(h.writes.all.length, 0);
  });
}

for (const [what, compare] of [["ahead of main", { [`main...${TARGET}`]: "ahead" }], ["diverged from main", { [`main...${TARGET}`]: "diverged" }], ["unknown to goal-agent", {}]]) {
  test(`a target ${what} is refused before any Home repo is read`, () => {
    const remotes = tmp();
    const a = homeRepo(remotes, A, "goal-steward");
    const { h, r } = run({ compare, remotes, homes: { [A]: {} } });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /not on goal-agent's main/);
    assert.ok(reads(h).every((c) => c.some((x) => x.includes("repos/hsmejky/goal-agent/compare"))), "only the compare check was read");
    assert.equal(h.writes.newPulls.length, 0);
    assert.deepEqual(branches(a.origin), ["main"]);
  });
}

for (const [what, token, message] of [
  ["no token", null, /no token|gh auth login/i],
  ["a token without the workflow scope", { value: SECRET, scopes: ["repo"] }, /workflow/],
  ["a classic token with no scopes at all", { value: SECRET, scopes: [] }, /workflow/],
]) {
  test(`${what} is refused before any read`, () => {
    const { h, r } = run({ token });
    assert.equal(r.code, 1);
    assert.match(r.stderr, message);
    assert.equal(reads(h).length, 0);
    assert.ok(!(r.stdout + r.stderr).includes(SECRET));
  });
}

test("one PR for the Home repo behind the target, none for the one at it, and the report says so", () => {
  const remotes = tmp();
  const a = homeRepo(remotes, A, "goal-steward");
  const b = homeRepo(remotes, B, "other-agent", { atTarget: true });
  const { h, r } = run({ remotes, homes: { [A]: {}, [B]: { name: "other-agent" } }, token: { value: SECRET } });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.deepEqual(branches(a.origin), [BRANCH, "main"]);
  assert.deepEqual(branches(b.origin), ["main"]);
  const [pr, ...more] = h.writes.newPulls;
  assert.equal(more.length, 0);
  assert.equal(pr.repo, A);
  assert.equal(pr.head, BRANCH);
  assert.equal(pr.base, "main");
  assert.equal(pr.title, `Move goal-agent pin to ${SHA12}`);
  assert.equal(git(a.origin, "rev-list", "--count", `main..${BRANCH}`).trim(), "1");
  assert.equal(git(a.origin, "log", "-1", "--format=%an <%ae>", BRANCH).trim(), "Pin User <pin@example.test>");
  assert.equal(git(a.origin, "log", "-1", "--format=%s", BRANCH).trim(), pr.title);
  assert.match(git(a.origin, "log", "-1", "--format=%B", BRANCH), new RegExp(TARGET));
  assert.match(git(a.origin, "show", `${BRANCH}:.claude/agents/goal-steward.md`), new RegExp(`^goal-agent-pin: ${TARGET}$`, "m"));
  const lines = r.stdout.split("\n");
  const rowA = lines.find((l) => l.includes(A));
  const rowB = lines.find((l) => l.includes(B));
  assert.match(rowA, new RegExp(`Home repo.*${OLD_PIN}.*PR opened`));
  assert.match(rowB, new RegExp(`Home repo.*${TARGET}.*no change`));
});

test("the PR body states the old and the new pin and lists no other repo's PR as a hand step", () => {
  const remotes = tmp();
  homeRepo(remotes, A, "goal-steward");
  const { h } = run({ remotes, roster: table(row("goal-steward", A)), homes: { [A]: {} } });
  const { body } = h.writes.newPulls[0];
  assert.match(body, new RegExp(OLD_PIN));
  assert.match(body, new RegExp(TARGET));
  assert.doesNotMatch(body, /hand steps|other Home repos|goal-agent-consult\.yml|close and reopen|Allow GitHub Actions/i);
});

test("a broken Roster row, a missing Home repo and a missing definition are each skipped and reported, and the run goes on", () => {
  const remotes = tmp();
  const a = homeRepo(remotes, A, "goal-steward");
  const roster = table("| `bad row` | not a repo |", row("ghost", "hsmejky/ghost-home"), row("other-agent", B), row("goal-steward", A));
  const { h, r } = run({ remotes, roster, homes: { [A]: {}, [B]: { name: "other-agent", noDefinition: true } } });
  assert.equal(r.code, 1);
  assert.equal(h.writes.newPulls.length, 1);
  assert.deepEqual(branches(a.origin), [BRANCH, "main"]);
  const skipped = r.stdout.split("\n").filter((l) => /skipped/.test(l));
  assert.equal(skipped.length, 3);
  assert.ok(skipped.some((l) => l.includes("bad row")));
  assert.ok(skipped.some((l) => l.includes("hsmejky/ghost-home")));
  assert.ok(skipped.some((l) => l.includes(B)));
});

test("a repo whose push fails is an error, and the other repos still get their PRs", () => {
  const remotes = tmp();
  const a = homeRepo(remotes, A, "goal-steward", { rejectPush: true });
  const b = homeRepo(remotes, B, "other-agent");
  const { h, r } = run({ remotes, homes: { [A]: {}, [B]: { name: "other-agent" } } });
  assert.equal(r.code, 1);
  assert.deepEqual(branches(a.origin), ["main"]);
  assert.deepEqual(branches(b.origin), [BRANCH, "main"]);
  assert.deepEqual(h.writes.newPulls.map((p) => p.repo), [B]);
  assert.match(r.stdout.split("\n").find((l) => l.includes(A)), /error.*rejected/);
  assert.ok(!(r.stdout + r.stderr).includes(SECRET));
});

test("the PR branch passes the real Home repo drift check", () => {
  const remotes = tmp();
  const a = homeRepo(remotes, A, "goal-steward");
  const { r } = run({ remotes, roster: table(row("goal-steward", A)), homes: { [A]: {} } });
  assert.equal(r.code, 0, r.stderr);
  const checkout = join(tmp(), "pr");
  git(tmp(), "clone", "-q", "--branch", BRANCH, a.origin, checkout);
  const c = spawnSync(process.execPath, [driftCheck, "--source", root, "--home", checkout], { encoding: "utf8", env: { ...process.env, GITHUB_EVENT_NAME: "pull_request", GITHUB_REPOSITORY: A } });
  assert.equal(c.status, 0, c.stderr);
  assert.match(c.stdout, /no drift/);
});
