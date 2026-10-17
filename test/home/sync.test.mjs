// The Home repo sync generator (R59, #115) at its process boundary: a fixture Home repo as a real git checkout
// with a local bare repo as origin, goal-agent at this checkout (or a local git repo of it) as the target, fake
// GitHub for the reachability check and the PR. The last test runs the generator's output through the real
// drift check (done-when 3 of #115 without the click: a PR opened with GITHUB_TOKEN starts no workflows).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHarness } from "../harness/index.mjs";
import { adoptFiles, fsTree } from "../../scripts/render/render.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const script = join(root, "scripts/home/sync.mjs");
const driftCheck = join(root, "scripts/home/drift-check.mjs");
const HOME = "hsmejky/goal-steward-home";
const TARGET = "b".repeat(40);

const cleanups = [];
after(() => cleanups.forEach((f) => f()));

const git = (cwd, ...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.test", "-c", "core.autocrlf=false", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "sync-"));
  cleanups.push(() => rmSync(d, { recursive: true, force: true }));
  return d;
};

/** A Home repo checkout on `main` with a bare origin; `prepare(dir)` may change the files before the first commit. */
function homeRepo(prepare = () => {}) {
  const dir = tmp();
  const home = join(dir, "home"), origin = join(dir, "origin.git");
  cpSync(join(root, "test/fixtures/goal-steward-home"), home, { recursive: true });
  prepare(home);
  git(dir, "init", "-q", "--bare", "-b", "main", origin);
  git(home, "init", "-q", "-b", "main");
  git(home, "add", "-A");
  git(home, "commit", "-q", "-m", "home");
  git(home, "remote", "add", "origin", origin);
  git(home, "push", "-q", "origin", "main");
  return { home, origin };
}

function run({ target = TARGET, compare = { [`main...${TARGET}`]: "behind" }, home = homeRepo().home, extra = ["--source", root], env = {}, repos = {} } = {}) {
  const h = createHarness({ repos: { "hsmejky/goal-agent": { compare }, [HOME]: {}, ...repos } });
  cleanups.push(() => h.cleanup());
  const r = h.run(process.execPath, [script, ...extra], { cwd: home, env: { GITHUB_REPOSITORY: HOME, TARGET: target, GH_TOKEN: "t", ...env } });
  return { h, r, home };
}

const branches = (origin) => git(origin, "branch", "--format=%(refname:short)").split("\n").filter(Boolean);

for (const target of ["abc1234", "B".repeat(40), "g".repeat(40), "b".repeat(39), "main", ""]) {
  test(`a target that is not a full 40-hex SHA is refused before anything else happens: ${JSON.stringify(target)}`, () => {
    const repo = homeRepo();
    const { h, r } = run({ target, home: repo.home });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /full 40-hex/);
    assert.equal(h.ghCalls.length, 0);
    assert.equal(h.writes.all.length, 0);
    assert.deepEqual(branches(repo.origin), ["main"]);
  });
}

for (const [what, compare] of [["ahead of main", { [`main...${TARGET}`]: "ahead" }], ["diverged from main", { [`main...${TARGET}`]: "diverged" }], ["unknown to goal-agent", {}]]) {
  test(`a target ${what} is refused: no branch, no PR`, () => {
    const repo = homeRepo();
    const { h, r } = run({ compare, home: repo.home });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /not on goal-agent's main/);
    assert.equal(h.writes.newPulls.length, 0);
    assert.deepEqual(branches(repo.origin), ["main"]);
    assert.equal(git(repo.home, "status", "--porcelain"), "");
  });
}

for (const status of ["behind", "identical"]) {
  test(`a target ${status} main is accepted`, () => {
    const { r, h } = run({ compare: { [`main...${TARGET}`]: status } });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(h.writes.newPulls.length, 1);
  });
}

test("one PR from a branch named for the target sets the pin, the uses SHAs and the rendered files", () => {
  const repo = homeRepo();
  const { h, r } = run({ home: repo.home });
  assert.equal(r.code, 0, r.stderr);
  const branch = `goal-agent-sync-${TARGET.slice(0, 12)}`;
  assert.deepEqual(branches(repo.origin).sort(), [branch, "main"]);
  const [pr] = h.writes.newPulls;
  assert.equal(pr.repo, HOME);
  assert.equal(pr.head, branch);
  assert.equal(pr.base, "main");
  assert.match(pr.title, new RegExp(TARGET.slice(0, 12)));
  const shown = (p) => git(repo.origin, "show", `${branch}:${p}`);
  assert.match(shown(".claude/agents/goal-steward.md"), new RegExp(`^goal-agent-pin: ${TARGET}$`, "m"));
  for (const f of ["audit", "staleness", "drift-check", "sync"]) assert.match(shown(`.github/workflows/goal-agent-${f}.yml`), new RegExp(`uses: hsmejky/goal-agent/\\.github/actions/home-${f}@${TARGET}`));
  assert.match(shown("docs/agents/goal-agents.md"), new RegExp(`blob/${TARGET}/docs/goal-agents-with-engineering-skills\\.md`));
  assert.equal(shown("scripts/guard/guard.mjs"), fsTree(root).read("scripts/guard/guard.mjs"));
  assert.equal(git(repo.origin, "log", "-1", "--format=%an", branch).trim(), "github-actions[bot]");
  assert.equal(git(repo.origin, "rev-list", "--count", `main..${branch}`).trim(), "1");
});

test("a Home repo that holds scripts/gate/ and scripts/home/ gets a PR whose one commit deletes both", () => {
  const repo = homeRepo((dir) => {
    for (const f of ["scripts/gate/gate.mjs", "scripts/gate/lib/a.mjs", "scripts/home/sync.mjs"]) {
      mkdirSync(dirname(join(dir, f)), { recursive: true });
      writeFileSync(join(dir, f), "// retired copy\n");
    }
  });
  const { r } = run({ home: repo.home });
  assert.equal(r.code, 0, r.stderr);
  const branch = `goal-agent-sync-${TARGET.slice(0, 12)}`;
  assert.equal(git(repo.origin, "rev-list", "--count", `main..${branch}`).trim(), "1");
  const deleted = git(repo.origin, "diff", "--name-only", "--diff-filter=D", `main..${branch}`).split("\n").filter(Boolean).sort();
  assert.deepEqual(deleted, ["scripts/gate/gate.mjs", "scripts/gate/lib/a.mjs", "scripts/home/sync.mjs"]);
  assert.equal(git(repo.origin, "ls-tree", "-r", "--name-only", branch, "scripts/gate", "scripts/home").trim(), "");
});

test("a re-run for the same target refuses with a clear message when the branch already exists", () => {
  const repo = homeRepo();
  const first = run({ home: repo.home });
  assert.equal(first.r.code, 0, first.r.stderr);
  git(repo.home, "checkout", "-q", "main");
  const again = run({ home: repo.home });
  assert.equal(again.r.code, 1);
  assert.match(again.r.stderr, /branch goal-agent-sync-b+ already exists.*close the earlier sync PR/);
  assert.equal(again.h.writes.newPulls.length, 0);
});

test("the PR body lists the Covered repos' hand steps, the other Home repos, and the limit that starts no workflows", () => {
  const { h } = run();
  const { body } = h.writes.newPulls[0];
  for (const repo of ["hsmejky/ai-plugin-manager", "hsmejky/goal-agent"]) assert.match(body, new RegExp(`${repo}.*goal-agent-review\\.yml.*goal-agent-consult\\.yml.*${TARGET}`));
  assert.match(body, /other Home repos/i);
  assert.match(body, /docs\/agents\/goal-agents\.md/);
  assert.match(body, /starts no workflows/);
  assert.match(body, /close and reopen/i);
  assert.match(body, /Allow GitHub Actions to create pull requests/);
});

const registry = (...rows) => ({
  files: { "docs/agents/goal-agents.md": ["# Goal agents", "", "| Goal agent | Label | Home repo |", "|---|---|---|", ...rows.map(([n, h]) => `| \`${n}\` | \`goal-agent:${n}\` | \`${h}\` |`), ""].join("\n") },
});

test("the PR body names the other Home repos found in the Covered repos' registries, not the synced Home repo", () => {
  const { h, r } = run({ repos: {
    "hsmejky/ai-plugin-manager": registry(["goal-steward", HOME], ["other-agent", "hsmejky/other-home"]),
    "hsmejky/goal-agent": { compare: { [`main...${TARGET}`]: "behind" }, ...registry(["goal-steward", HOME], ["third", "hsmejky/third-home"], ["other-agent", "hsmejky/other-home"]) },
  } });
  assert.equal(r.code, 0, r.stderr);
  const { body } = h.writes.newPulls[0];
  assert.match(body, /- \[ \] `hsmejky\/other-home` \(covers `hsmejky\/ai-plugin-manager`, `hsmejky\/goal-agent`\).*b{40}/);
  assert.match(body, /- \[ \] `hsmejky\/third-home` \(covers `hsmejky\/goal-agent`\)/);
  assert.ok(!body.includes(`\`${HOME}\` (covers`), "the synced Home repo is not listed");
});

test("a Covered repo whose registry cannot be read gets a line in the PR body and the sync still opens the PR", () => {
  const { h, r } = run({ repos: { "hsmejky/ai-plugin-manager": registry(["a", "hsmejky/other-home"]) } });
  assert.equal(r.code, 0, r.stderr);
  const { body } = h.writes.newPulls[0];
  assert.match(body, /`hsmejky\/other-home` \(covers/);
  assert.match(body, /Could not read the registry of hsmejky\/goal-agent: /);
  assert.ok(!body.includes("Could not read the registry of hsmejky/ai-plugin-manager"));
});

test("a Home repo already at the target gets no branch and no PR", () => {
  const repo = homeRepo((dir) => {
    const files = adoptFiles({ source: fsTree(root), home: fsTree(dir), name: "goal-steward", pin: TARGET });
    for (const [p, text] of Object.entries(files)) {
      if (text === null) { rmSync(join(dir, p)); continue; }
      mkdirSync(dirname(join(dir, p)), { recursive: true });
      writeFileSync(join(dir, p), text);
    }
  });
  const { h, r } = run({ home: repo.home });
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /already at/);
  assert.equal(h.writes.newPulls.length, 0);
  assert.deepEqual(branches(repo.origin), ["main"]);
});

test("the generator fetches the target from a git remote when no --source is given", () => {
  const src = tmp();
  for (const d of ["docs", "templates", "scripts"]) cpSync(join(root, d), join(src, d), { recursive: true });
  git(src, "init", "-q", "-b", "main");
  git(src, "add", "-A");
  git(src, "commit", "-q", "-m", "goal-agent");
  const sha = git(src, "rev-parse", "HEAD").trim();
  const repo = homeRepo();
  const { h, r } = run({ target: sha, compare: { [`main...${sha}`]: "identical" }, home: repo.home, extra: ["--remote", src] });
  assert.equal(r.code, 0, r.stderr);
  assert.match(git(repo.origin, "show", `goal-agent-sync-${sha.slice(0, 12)}:.claude/agents/goal-steward.md`), new RegExp(`^goal-agent-pin: ${sha}$`, "m"));
  assert.equal(h.writes.newPulls.length, 1);
});

test("the PR's files pass the drift check once it is started (done-when 3)", () => {
  const repo = homeRepo();
  const { r } = run({ home: repo.home });
  assert.equal(r.code, 0, r.stderr);
  const branch = `goal-agent-sync-${TARGET.slice(0, 12)}`;
  const checkout = join(tmp(), "pr");
  git(tmp(), "clone", "-q", "--branch", branch, repo.origin, checkout);
  const c = spawnSync(process.execPath, [driftCheck, "--source", root, "--home", checkout], { encoding: "utf8", env: { ...process.env, GITHUB_EVENT_NAME: "pull_request", GITHUB_REPOSITORY: HOME } });
  assert.equal(c.status, 0, c.stderr);
  assert.match(c.stdout, /no drift/);
});

test("a Home repo that has not adopted the text yet is refused with no branch and no PR", () => {
  const repo = homeRepo((dir) => rmSync(join(dir, "docs/agents/goal-agents.md")));
  const { h, r } = run({ home: repo.home });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /first adoption/);
  assert.equal(h.writes.newPulls.length, 0);
  assert.deepEqual(branches(repo.origin), ["main"]);
});
