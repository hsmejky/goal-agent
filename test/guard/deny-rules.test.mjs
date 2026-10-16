import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHarness } from "../harness/index.mjs";
import { hookCommand } from "../../scripts/guard/hook-command.mjs";

const scriptsSrc = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "scripts");
// The Home repo holds a pinned copy of scripts/ laid out as in goal-agent; the hooks run it from origin/main.
const installScripts = (dir) => { for (const sub of ["guard", "gate"]) cpSync(join(scriptsSrc, sub), join(dir, "scripts", sub), { recursive: true }); };
const cleanups = [];
after(() => cleanups.forEach((f) => f()));

const DEFINITION = `---
name: alpha
---
## Covered repos

- me/covered-one
- me/covered-two

## Watched sources

- other/watched
`;

const git = (cwd, ...args) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
};

function homeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "goal-agent-home-"));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@example.com");
  git(dir, "config", "user.name", "t");
  mkdirSync(join(dir, ".claude", "agents"), { recursive: true });
  writeFileSync(join(dir, ".claude", "agents", "alpha.md"), DEFINITION);
  mkdirSync(join(dir, "memory"));
  writeFileSync(join(dir, "memory", "a.md"), "x");
  installScripts(dir);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "init");
  git(dir, "remote", "add", "origin", "https://github.com/me/home.git");
  git(dir, "update-ref", "refs/remotes/origin/main", "HEAD");
  return dir;
}

const h = createHarness({ repos: { "me/home": { issues: [] } } });
cleanups.push(() => h.cleanup());
const repo = homeRepo();
const recordDir = mkdtempSync(join(tmpdir(), "goal-agent-records-"));
cleanups.push(() => rmSync(recordDir, { recursive: true, force: true }));
const fire = (mode, event) =>
  h.run("bash", ["-c", hookCommand(mode)], { cwd: repo, input: JSON.stringify(event), env: { GOAL_AGENT_GUARD_DIR: recordDir, CLAUDE_CODE_REMOTE: "true" }, allowViolations: true });
const started = fire("session-start", { hook_event_name: "SessionStart", session_id: "s1", cwd: repo, source: "startup" });
assert.equal(started.code, 0, started.stderr);

const call = (tool_name, tool_input) =>
  fire("pre-tool-use", { hook_event_name: "PreToolUse", session_id: "s1", cwd: repo, tool_name, tool_input });
const bash = (command) => call("Bash", { command });

function verdict(r) {
  assert.equal(r.code, 0, r.stderr);
  if (r.stdout.trim() === "") return null;
  const out = JSON.parse(r.stdout).hookSpecificOutput;
  assert.equal(out.permissionDecision, "deny");
  assert.ok(out.permissionDecisionReason.length > 10);
  return out.permissionDecisionReason;
}
const deny = (r) => assert.ok(verdict(r), "expected a deny");
const allow = (r) => assert.equal(verdict(r), null);

describe("Skill and MCP tools", () => {
  test("Skill is denied; other built-in tools are allowed", () => {
    deny(call("Skill", { skill: "tdd" }));
    allow(call("Read", { file_path: join(repo, "GLOSSARY.md") }));
  });
  test("an MCP tool other than add_repo is denied; add_repo is allowed", () => {
    deny(call("mcp__github__create_issue", {}));
    deny(call("mcp__claude_ai_Google_Drive__authenticate", {}));
    allow(call("mcp__session__add_repo", { repo: "me/covered-one" }));
  });
});

describe("file writes", () => {
  for (const tool of ["Edit", "Write", "NotebookEdit"]) {
    const key = tool === "NotebookEdit" ? "notebook_path" : "file_path";
    test(`${tool} outside memory/ in the Home repo is denied, inside memory/ is allowed`, () => {
      deny(call(tool, { [key]: join(repo, "README.md") }));
      deny(call(tool, { [key]: join(repo, ".claude", "hooks", "guard.mjs") }));
      deny(call(tool, { [key]: join(repo, "memory", "..", "CLAUDE.md") }));
      deny(call(tool, { [key]: "CLAUDE.md" })); // relative to the Home repo cwd
      allow(call(tool, { [key]: join(repo, "memory", "new", "learning.md") }));
      allow(call(tool, { [key]: "memory/a.md" }));
    });
  }
  test("a path outside the Home repo is allowed, except the guard's session record", () => {
    allow(call("Write", { file_path: join(tmpdir(), "scratch.txt") }));
    deny(call("Write", { file_path: join(recordDir, "s1.json") }));
    deny(call("Edit", { file_path: join(recordDir, "s1.json") }));
  });
  test("a write without a path is denied", () => deny(call("Write", {})));
});

describe("git clone and gh repo clone", () => {
  test("denied, including inside compound and wrapped commands", () => {
    deny(bash("git clone https://github.com/me/covered-one"));
    deny(bash("git -C /tmp clone https://github.com/me/covered-one"));
    deny(bash("gh repo clone me/covered-one"));
    deny(bash("cd /tmp && git clone x"));
    deny(bash('bash -c "gh repo clone me/covered-one"'));
    deny(bash("echo $(git clone x)"));
  });
  test("near misses are allowed", () => {
    allow(bash("git status"));
    allow(bash("git log --oneline"));
    allow(bash("gh repo view me/covered-one"));
    allow(bash('echo "git clone is denied"'));
  });
});

describe("gh api", () => {
  const ISSUE = "repos/me/covered-one/issues";
  test("a GET anywhere is allowed", () => {
    allow(bash("gh api repos/other/elsewhere/pulls/3"));
    allow(bash("gh api repos/me/covered-one/pulls/3/files --paginate"));
    allow(bash("gh api -X GET repos/other/elsewhere/issues -f state=open"));
    allow(bash("gh api --method=get repos/other/elsewhere/issues -F per_page=5"));
  });
  test("a write under issues of the Home repo or a Covered repo is allowed", () => {
    allow(bash(`gh api -X POST ${ISSUE}/7/comments -f body=hi`));
    allow(bash(`gh api ${ISSUE} -f title=t -f body=b`));
    allow(bash(`gh api --method PATCH /${ISSUE}/7 -f state=closed`));
    allow(bash("gh api -X POST repos/me/covered-two/issues/7/comments --input body.json"));
    allow(bash("gh api repos/me/home/issues/5 -X PATCH -f body=b"));
    allow(bash("gh api -XPOST repos/ME/Covered-One/issues/7/comments -f body=hi"));
  });
  test("-f, -F and --input without an explicit GET are a POST", () => {
    deny(bash("gh api repos/me/covered-one/pulls -f title=t"));
    deny(bash("gh api repos/me/covered-one/git/refs -F ref=x"));
    deny(bash("gh api repos/me/covered-one/contents/a.md --input patch.json"));
    deny(bash("gh api repos/me/covered-one/labels --raw-field name=x"));
  });
  test("explicit non-GET methods outside issues are denied", () => {
    deny(bash("gh api -X DELETE repos/me/covered-one/git/refs/heads/x"));
    deny(bash("gh api --method PUT repos/me/covered-one/pulls/3/merge"));
    deny(bash("gh api -X POST repos/me/covered-one/pulls/3/comments -f body=x"));
    deny(bash("gh api -X POST repos/me/covered-one/issuesx -f body=x"));
  });
  test("issue writes in a repo that is neither Home nor Covered are denied", () => {
    deny(bash("gh api -X POST repos/other/watched/issues/7/comments -f body=hi"));
    deny(bash("gh api repos/me/covered-three/issues -f title=t"));
    deny(bash("gh api -X PATCH repos/me/covered-onex/issues/7 -f state=closed"));
  });
  test("a traversal or unresolved variable in the path is denied", () => {
    deny(bash("gh api -X POST repos/me/covered-one/issues/../pulls/1/comments -f body=x"));
    deny(bash('gh api -X POST "repos/me/covered-one/issues/$N/comments" -f body=x'));
  });
  test("a write hidden in a compound command or a nested shell is denied", () => {
    deny(bash("gh api repos/me/covered-one/issues/1 && gh api -X DELETE repos/x/y/git/refs/z"));
    deny(bash('bash -c "gh api -X DELETE repos/x/y/git/refs/z"'));
    deny(bash("GH_TOKEN=x gh api -X DELETE repos/x/y/git/refs/z"));
  });
  test("a GraphQL mutation is denied; a query is allowed", () => {
    deny(bash("gh api graphql -f query='mutation { addStar(input:{starrableId:\"x\"}) { clientMutationId } }'"));
    deny(bash("gh api graphql -F query=@m.graphql"));
    deny(bash("gh api graphql --input m.json"));
    allow(bash("gh api graphql -f query='query { viewer { login } }'"));
  });
  test("other commands that mention gh or api are allowed", () => {
    allow(bash("ls -la"));
    allow(bash("grep -r 'gh api -X POST' docs"));
    allow(bash("node scripts/x.mjs"));
  });
});

describe("Covered repos come only from origin/main", () => {
  test("a working-tree edit of the definition does not widen the write set", () => {
    writeFileSync(join(repo, ".claude", "agents", "alpha.md"), DEFINITION + "\n- me/covered-three\n");
    deny(bash("gh api repos/me/covered-three/issues -f title=t"));
    writeFileSync(join(repo, ".claude", "agents", "alpha.md"), DEFINITION);
  });
  test("a Covered repo is read from the Covered repos section only", () => {
    deny(bash("gh api repos/other/watched/issues -f title=t"));
  });
});
