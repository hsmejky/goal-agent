import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const guard = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "scripts", "guard", "guard.mjs");
const cleanups = [];
after(() => cleanups.forEach((f) => f()));

const git = (cwd, ...args) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout;
};
const write = (repo, path, content = "x") => {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), content);
};
const commit = (repo, files, msg = "c") => {
  for (const f of files) write(repo, f, `${msg}${Math.random()}`);
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", msg);
};

// A real working repo with a real bare origin; origin/main is the pushed baseline.
function setup() {
  const root = mkdtempSync(join(tmpdir(), "goal-agent-push-"));
  cleanups.push(() => rmSync(root, { recursive: true, force: true }));
  const origin = join(root, "origin.git");
  const repo = join(root, "work");
  git(root, "init", "-q", "--bare", "-b", "main", origin);
  git(root, "init", "-q", "-b", "main", repo);
  git(repo, "config", "user.email", "t@example.com");
  git(repo, "config", "user.name", "t");
  git(repo, "remote", "add", "origin", origin);
  commit(repo, [".claude/hooks/guard.mjs", "memory/a.md"], "init");
  git(repo, "push", "-q", "origin", "main");
  const records = join(root, "records");
  mkdirSync(records);
  writeFileSync(join(records, "s1.json"), JSON.stringify({ version: 1, halted: false }));
  const tool = (command) =>
    spawnSync("node", [guard, "pre-tool-use"], {
      encoding: "utf8",
      env: { ...process.env, GOAL_AGENT_GUARD_DIR: records, CLAUDE_CODE_REMOTE: "true" },
      input: JSON.stringify({ hook_event_name: "PreToolUse", session_id: "s1", cwd: repo, tool_name: "Bash", tool_input: { command } }),
    });
  const originMain = () => git(origin, "rev-parse", "main").trim();
  return { repo, tool, originMain };
}

const reasonOf = (r) => {
  assert.equal(r.status, 0, r.stderr);
  if (!r.stdout.trim()) return null;
  const o = JSON.parse(r.stdout).hookSpecificOutput;
  assert.equal(o.permissionDecision, "deny");
  return o.permissionDecisionReason;
};
const allowed = (r) => assert.equal(reasonOf(r), null);
const denied = (r) => {
  const reason = reasonOf(r);
  assert.ok(reason, "expected a deny");
  return reason;
};

describe("push rules", () => {
  test("a plain push to main of memory-only commits is allowed", () => {
    const t = setup();
    commit(t.repo, ["memory/b.md"]);
    commit(t.repo, ["memory/sub/c.md", "memory/a.md"]);
    for (const c of ["git push", "git push origin", "git push origin main", "git push origin HEAD:main", "git push origin main:refs/heads/main", "git push -q origin main"]) {
      allowed(t.tool(c));
    }
  });

  test("the allowed push really works against the origin (the guard matched what git does)", () => {
    const t = setup();
    commit(t.repo, ["memory/b.md"]);
    allowed(t.tool("git push origin main"));
    git(t.repo, "push", "-q", "origin", "main");
    assert.equal(t.originMain(), git(t.repo, "rev-parse", "HEAD").trim());
  });

  test("nothing to push is allowed", () => {
    allowed(setup().tool("git push origin main"));
  });

  test("chained pushes are denied", () => {
    const t = setup();
    commit(t.repo, ["memory/b.md"]);
    for (const c of [
      "git push origin main && echo done",
      "echo hi; git push origin main",
      "git push origin main | cat",
      "git push origin main & git push --force",
      "git push origin main\nrm -rf x",
      "echo $(git push origin main)",
      "git push origin main > out.txt",
      "bash -c 'git push origin main'",
      "cd .. && git push",
    ]) {
      denied(t.tool(c));
    }
  });

  test("force, force-with-lease, delete and other history rewrites are denied", () => {
    const t = setup();
    commit(t.repo, ["memory/b.md"]);
    for (const c of [
      "git push --force origin main",
      "git push -f origin main",
      "git push origin main --force-with-lease",
      "git push --force-with-lease=main origin main",
      "git push origin +main",
      "git push origin +HEAD:main",
      "git push --delete origin main",
      "git push -d origin main",
      "git push origin :main",
      "git push --mirror",
      "git push --all",
      "git push --prune origin",
    ]) {
      denied(t.tool(c));
    }
  });

  test("pushes to anything but origin main are denied", () => {
    const t = setup();
    commit(t.repo, ["memory/b.md"]);
    for (const c of ["git push origin main:other", "git push origin HEAD:refs/heads/other", "git push origin other", "git push other main", "git push https://example.com/x.git main", "git push origin main extra", "git push origin v1"]) {
      denied(t.tool(c));
    }
    git(t.repo, "checkout", "-q", "-b", "feature");
    denied(t.tool("git push"));
    denied(t.tool("git push origin feature"));
    denied(t.tool("git push origin feature:other"));
  });

  test("a feature branch with memory-only commits may be pushed to main explicitly", () => {
    const t = setup();
    git(t.repo, "checkout", "-q", "-b", "feature");
    commit(t.repo, ["memory/b.md"]);
    allowed(t.tool("git push origin feature:main"));
    allowed(t.tool("git push origin HEAD:main"));
  });

  test("a commit touching a file outside memory is denied, including the guard and the definition", () => {
    for (const file of ["README.md", ".claude/hooks/guard.mjs", ".claude/agents/alpha.md", "memory.md", "memory-x/a.md"]) {
      const t = setup();
      commit(t.repo, [file]);
      assert.match(denied(t.tool("git push origin main")), /outside memory/);
    }
  });

  test("an early commit outside memory is denied even when the last commit only touches memory", () => {
    const t = setup();
    commit(t.repo, [".claude/hooks/guard.mjs"], "tamper");
    commit(t.repo, ["memory/b.md"], "learning");
    assert.match(denied(t.tool("git push origin main")), /\.claude\/hooks\/guard\.mjs/);
    denied(t.tool("git push"));
  });

  test("a commit that is later reverted is still denied", () => {
    const t = setup();
    commit(t.repo, ["README.md"], "add");
    git(t.repo, "revert", "--no-edit", "HEAD");
    denied(t.tool("git push origin main"));
  });

  test("a merge commit bringing in a non-memory file is denied", () => {
    const t = setup();
    git(t.repo, "checkout", "-q", "-b", "side");
    commit(t.repo, ["src/x.js"], "side");
    git(t.repo, "checkout", "-q", "main");
    commit(t.repo, ["memory/b.md"], "mem");
    git(t.repo, "merge", "-q", "--no-ff", "-m", "merge", "side");
    denied(t.tool("git push origin main"));
  });

  test("an unresolvable ref or a missing origin/main fails closed", () => {
    const t = setup();
    denied(t.tool("git push origin nosuchref:main"));
    git(t.repo, "update-ref", "-d", "refs/remotes/origin/main");
    denied(t.tool("git push origin main"));
  });

  test("other commands, and other git commands, are not push-judged", () => {
    const t = setup();
    commit(t.repo, ["README.md"]);
    for (const c of ["git status", "git log --oneline", "echo pushing", "git commit -m 'push it'".replace("'push it'", "x")]) allowed(t.tool(c));
  });

  test("git push inside quoted text is not a push", () => {
    const t = setup();
    commit(t.repo, ["README.md"]);
    for (const c of [
      `echo "notes: do not git push here"`,
      `grep -rn "git push" docs`,
      `echo 'git push origin main'`,
      `git commit -m "explain git push rules"`,
    ]) allowed(t.tool(c));
  });

  test("a push hidden behind a shell wrapper or substitution is still judged", () => {
    const t = setup();
    commit(t.repo, ["README.md"]);
    for (const c of ["bash -c 'git push --force'", `echo "$(git push --force)"`, "echo `git push --force`", "git -C . push --force"]) denied(t.tool(c));
  });
});
