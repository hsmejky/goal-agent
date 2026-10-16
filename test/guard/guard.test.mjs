import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHarness } from "../harness/index.mjs";
import { CLOUD_ENV } from "./cloud-env.mjs";
import { hookCommand, hookSettings } from "../../scripts/guard/hook-command.mjs";
import { findHaltMarker, hasHaltMarker } from "../../scripts/guard/halt-marker.mjs";
import { definitionName, parseCoveredRepos, parseRemote } from "../../scripts/guard/identity.mjs";

const scriptsSrc = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "scripts");
// The Home repo holds a pinned copy of scripts/ laid out as in goal-agent; the hooks run it from origin/main.
const installScripts = (dir) => { for (const sub of ["guard", "lib"]) cpSync(join(scriptsSrc, sub), join(dir, "scripts", sub), { recursive: true }); };
const cleanups = [];
after(() => cleanups.forEach((f) => f()));

const DEFINITION = `---
name: alpha
---
You are alpha.

## Goal

Keep things true.

## Covered repos

The guard reads this list.

- me/covered-one
- me/covered-two

## Watched sources

- not/a-covered-repo
`;

const git = (cwd, ...args) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout;
};

// A real temporary git repo whose origin/main holds the definition and the guard.
function homeRepo({ definition = DEFINITION, files = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "goal-agent-home-"));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@example.com");
  git(dir, "config", "user.name", "t");
  mkdirSync(join(dir, ".claude", "agents"), { recursive: true });
  if (definition !== null) writeFileSync(join(dir, ".claude", "agents", "alpha.md"), definition);
  installScripts(dir);
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), c);
  }
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "init");
  git(dir, "remote", "add", "origin", "https://github.com/me/home.git");
  git(dir, "update-ref", "refs/remotes/origin/main", "HEAD");
  return dir;
}

const stateIssue = (body, extra = {}) => ({ number: 5, title: "alpha Goal agent: state", labels: ["goal-agent:state"], body, ...extra });

function setup({ issues = [], repo = homeRepo(), curl, env = {} } = {}) {
  const h = createHarness({ repos: { "me/home": { issues } } });
  cleanups.push(() => h.cleanup());
  const recordDir = mkdtempSync(join(tmpdir(), "goal-agent-records-"));
  cleanups.push(() => rmSync(recordDir, { recursive: true, force: true }));
  const fire = (mode, event) =>
    h.run("bash", ["-c", hookCommand(mode)], {
      cwd: repo,
      input: JSON.stringify(event),
      env: { GOAL_AGENT_GUARD_DIR: recordDir, ...CLOUD_ENV, ...env },
      allowViolations: true,
    });
  const start = (id = "s1", extra = {}) => fire("session-start", { hook_event_name: "SessionStart", session_id: id, cwd: repo, source: "startup", ...extra });
  const tool = (id = "s1", name = "Bash", input = { command: "ls" }) =>
    fire("pre-tool-use", { hook_event_name: "PreToolUse", session_id: id, cwd: repo, tool_name: name, tool_input: input });
  return { h, repo, recordDir, start, tool };
}

const denied = (r) => {
  assert.equal(r.code, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
  assert.ok(out.hookSpecificOutput.permissionDecisionReason.length > 10);
  return out.hookSpecificOutput.permissionDecisionReason;
};
const allowed = (r) => {
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout.trim(), "");
};

describe("Halted verdict", () => {
  test("a State issue with the halt marker denies every tool, with a reason", () => {
    const t = setup({ issues: [stateIssue("## Order\n\n<!-- goal-agent:halted by user 2026-10-01 -->\n")] });
    assert.equal(t.start().code, 0);
    for (const name of ["Bash", "Read", "Edit", "Skill", "mcp__x__y"]) {
      assert.match(denied(t.tool("s1", name)), /Halted/);
    }
  });

  test("no State issue: not Halted, tools allowed", () => {
    const t = setup({ issues: [] });
    t.start();
    allowed(t.tool());
  });

  test("a State issue without the marker: tools allowed", () => {
    const t = setup({ issues: [stateIssue("## Order\n\n1. me/covered-one#1\n")] });
    t.start();
    allowed(t.tool());
  });

  test("any matching State issue with the marker is Halted", () => {
    const t = setup({
      issues: [
        stateIssue("## Order\n", { number: 5 }),
        stateIssue("<!-- goal-agent:halted -->\n", { number: 6 }),
      ],
    });
    t.start();
    denied(t.tool());
  });

  test("a halted State issue beyond the first page of open issues is still found", () => {
    const filler = Array.from({ length: 100 }, (_, i) => stateIssue("", { number: 100 + i, title: `beta Goal agent: state ${i}` }));
    const t = setup({ issues: [...filler, stateIssue("<!-- goal-agent:halted -->\n", { number: 300 })] });
    t.start();
    denied(t.tool());
  });

  test("another agent's State issue and non-State issues are ignored", () => {
    const t = setup({
      issues: [
        stateIssue("<!-- goal-agent:halted -->\n", { number: 5, title: "alpha-two Goal agent: state" }),
        stateIssue("<!-- goal-agent:halted -->\n", { number: 6, title: "beta Goal agent: state" }),
        { number: 7, title: "alpha finding", labels: ["goal-agent:alpha"], body: "<!-- goal-agent:halted -->" },
        stateIssue("<!-- goal-agent:halted -->\n", { number: 8, state: "closed" }),
      ],
    });
    t.start();
    allowed(t.tool());
  });

  test("a read error is Halted", () => {
    // The Home repo is unknown to the fake GitHub, so the issues call fails (404).
    const repo = homeRepo();
    git(repo, "remote", "set-url", "origin", "https://github.com/me/unknown.git");
    const t = setup({ repo });
    t.start();
    assert.match(denied(t.tool()), /could not read/);
  });

  test("an unreadable definition (none, or two) is Halted", () => {
    for (const repo of [homeRepo({ definition: null }), homeRepo({ files: { ".claude/agents/beta.md": DEFINITION } })]) {
      const t = setup({ repo });
      t.start();
      denied(t.tool());
    }
  });

  test("a Run now session is guarded like any other", () => {
    const t = setup({ issues: [stateIssue("<!-- goal-agent:halted -->\n")] });
    t.start("run-now", { source: "startup", prompt: "Run now: https://github.com/me/covered-one/pull/3" });
    denied(t.tool("run-now"));
  });

  test("the verdict is a per-session record; PreToolUse makes no GitHub call", () => {
    const t = setup({ issues: [stateIssue("## Order\n")] });
    t.start("a");
    assert.ok(readdirSync(t.recordDir).includes("a.json"));
    allowed(t.tool("a"));
    allowed(t.tool("a"));
    assert.equal(t.h.violations.length, 0);
  });
});

describe("fail closed", () => {
  test("a missing session record denies every tool", () => {
    const t = setup();
    assert.match(denied(t.tool("never-started")), /no session record/);
  });

  test("an unreadable or malformed session record denies every tool", () => {
    const t = setup();
    for (const content of ["not json", "{}", '{"version":1,"halted":"no"}']) {
      writeFileSync(join(t.recordDir, "bad.json"), content);
      denied(t.tool("bad"));
    }
  });

  test("an unsafe or missing session id denies and writes nothing outside the record dir", () => {
    const t = setup();
    denied(t.tool("../escape"));
    denied(fireRaw(t, {}));
    t.start("../escape");
    assert.equal(existsSync(join(t.recordDir, "..", "escape.json")), false);
  });

  test("a guard that cannot be extracted from origin/main exits 2 (blocking)", () => {
    const t = setup();
    git(t.repo, "update-ref", "-d", "refs/remotes/origin/main");
    const r = t.tool();
    assert.equal(r.code, 2);
  });

  test("a garbled event denies", () => {
    const t = setup();
    const r = t.h.run("bash", ["-c", hookCommand("pre-tool-use")], { cwd: t.repo, input: "garbage", env: { GOAL_AGENT_GUARD_DIR: t.recordDir, ...CLOUD_ENV } });
    denied(r);
  });
});

function fireRaw(t, event) {
  return t.h.run("bash", ["-c", hookCommand("pre-tool-use")], { cwd: t.repo, input: JSON.stringify(event), env: { GOAL_AGENT_GUARD_DIR: t.recordDir, ...CLOUD_ENV } });
}

describe("origin/main is the source of truth", () => {
  test("working-tree edits to the guard and the definition have no effect", () => {
    const t = setup({ issues: [stateIssue("<!-- goal-agent:halted -->\n")] });
    // Neuter the guard on disk and rename the agent in the working-tree definition.
    writeFileSync(join(t.repo, "scripts", "guard", "rules.mjs"), "export const RULES = []; export const decide = () => null;\n");
    writeFileSync(join(t.repo, "scripts", "guard", "guard.mjs"), "process.exit(0);\n");
    writeFileSync(join(t.repo, ".claude", "agents", "alpha.md"), "---\nname: other\n---\n## Covered repos\n- x/y\n");
    writeFileSync(join(t.repo, ".claude", "agents", "gamma.md"), "extra\n");
    t.start();
    denied(t.tool());
  });

  test("a working-tree edit cannot un-halt a session", () => {
    const t = setup({ issues: [stateIssue("<!-- goal-agent:halted -->\n")] });
    t.start();
    rmSync(join(t.repo, "scripts"), { recursive: true });
    denied(t.tool());
  });

  test("the hook command is a settings block for both events", () => {
    const s = hookSettings();
    assert.match(s.hooks.SessionStart[0].hooks[0].command, /guard\.mjs" session-start/);
    assert.match(s.hooks.PreToolUse[0].hooks[0].command, /guard\.mjs" pre-tool-use/);
    assert.match(hookCommand("pre-tool-use"), /origin\/main/);
  });
});

describe("scope: cloud sessions only (CLAUDE_CODE_REMOTE)", () => {
  const HALTED = [stateIssue("<!-- goal-agent:halted -->\n")];
  // `unset` drops the variable; the others set it to a value that is not exactly "true".
  const nonCloud = { unset: undefined, "false": "false", empty: "", TRUE: "TRUE", "1": "1" };
  const envFor = (v) => ({ CLAUDE_CODE_REMOTE: v });

  for (const [label, v] of Object.entries(nonCloud)) {
    test(`CLAUDE_CODE_REMOTE ${label}: SessionStart makes no gh call and writes no record`, () => {
      const t = setup({ issues: HALTED, env: envFor(v) });
      assert.equal(t.start().code, 0);
      assert.deepEqual(t.h.ghCalls, []);
      assert.deepEqual(readdirSync(t.recordDir), []);
    });

    test(`CLAUDE_CODE_REMOTE ${label}: PreToolUse allows Skill, Write outside memory/ and mcp__ tools with no record`, () => {
      const t = setup({ issues: HALTED, env: envFor(v) });
      allowed(t.tool("none", "Skill", { skill: "tdd" }));
      allowed(t.tool("none", "Write", { file_path: join(t.repo, "docs", "x.md"), content: "x" }));
      allowed(t.tool("none", "mcp__x__y", {}));
    });
  }

  test("the hook command exits 0 and allows outside a cloud session even when origin/main has no scripts/", () => {
    const repo = homeRepo();
    git(repo, "rm", "-rq", "scripts");
    git(repo, "commit", "-q", "-m", "drop scripts");
    git(repo, "update-ref", "refs/remotes/origin/main", "HEAD");
    for (const v of [undefined, "false"]) {
      const t = setup({ repo, env: { CLAUDE_CODE_REMOTE: v } });
      assert.equal(t.start().code, 0);
      allowed(t.tool("none", "Skill", { skill: "tdd" }));
    }
  });

  test("a cloud session whose origin/main has no scripts/ is still blocked (exit 2)", () => {
    const repo = homeRepo();
    git(repo, "rm", "-rq", "scripts");
    git(repo, "commit", "-q", "-m", "drop scripts");
    git(repo, "update-ref", "refs/remotes/origin/main", "HEAD");
    assert.equal(setup({ repo }).tool().code, 2);
  });

  test("CLAUDE_CODE_REMOTE true with no session record: PreToolUse denies every tool", () => {
    const t = setup();
    for (const name of ["Bash", "Read", "Skill", "mcp__x__y"]) denied(t.tool("no-such-session", name));
  });

  test("CLAUDE_CODE_REMOTE true: SessionStart reads GitHub and writes the record", () => {
    const t = setup({ issues: HALTED });
    t.start();
    assert.ok(t.h.ghCalls.length > 0);
    assert.match(denied(t.tool("s1", "Read")), /Halted/);
  });
});

describe("definition name", () => {
  test("is the file name of the single .md definition", () => {
    assert.equal(definitionName([".claude/agents/alpha-2.md"]), "alpha-2");
    assert.equal(definitionName(["alpha.md", "notes.txt"]), "alpha");
  });

  test("rejects none, several, or an invalid name", () => {
    assert.throws(() => definitionName([], "on origin/main"), /exactly one definition.*on origin\/main.*found 0/);
    assert.throws(() => definitionName(["a.md", "b.md"]), /found 2/);
    assert.throws(() => definitionName(["Alpha.md"]), /invalid agent name/);
  });
});

describe("shared halt-marker reader", () => {
  test("matches a body line opening with the marker", () => {
    assert.equal(hasHaltMarker("<!-- goal-agent:halted -->"), true);
    assert.equal(hasHaltMarker("## Order\r\n<!-- goal-agent:halted by user -->\r\n"), true);
    assert.equal(hasHaltMarker("<!-- goal-agent:halted-->"), true);
    assert.equal(findHaltMarker("a\n<!-- goal-agent:halted x -->"), "<!-- goal-agent:halted x -->");
  });
  test("does not match look-alikes", () => {
    for (const b of ["", null, undefined, "text <!-- goal-agent:halted -->", " <!-- goal-agent:halted -->", "<!-- goal-agent:halted-later -->", "<!-- goal-agent:state -->"]) {
      assert.equal(hasHaltMarker(b), false, String(b));
    }
  });
});

describe("identity parsing", () => {
  test("remote URLs", () => {
    assert.equal(parseRemote("https://github.com/me/home.git\n"), "me/home");
    assert.equal(parseRemote("git@github.com:me/home.git"), "me/home");
    assert.equal(parseRemote("http://local_proxy@127.0.0.1:1234/git/me/home"), "me/home");
  });
  test("only the Covered repos section is parsed", () => {
    assert.deepEqual(parseCoveredRepos(DEFINITION), ["me/covered-one", "me/covered-two"]);
    assert.deepEqual(parseCoveredRepos("## Covered repos\n\n- <owner>/<repo>\n"), []);
  });
});
