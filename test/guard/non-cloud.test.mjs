import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const guard = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "scripts", "guard", "guard.mjs");
const cleanups = [];
after(() => cleanups.forEach((f) => f()));

// Spawns guard.mjs directly (no hook shell prefix), so only the guard's own cloud check can stop it.
function run(mode, remote) {
  const root = mkdtempSync(join(tmpdir(), "goal-agent-noncloud-"));
  cleanups.push(() => rmSync(root, { recursive: true, force: true }));
  const records = join(root, "records");
  const bin = join(root, "bin");
  const ghCalls = join(root, "gh-calls");
  mkdirSync(records);
  mkdirSync(bin);
  writeFileSync(join(bin, "gh"), `#!/bin/sh\necho "$@" >> "${ghCalls.replaceAll("\\", "/")}"\nexit 1\n`, { mode: 0o755 });
  writeFileSync(join(bin, "gh.cmd"), `@echo %* >> "${ghCalls}"\r\n@exit /b 1\r\n`);
  const env = { ...process.env, GOAL_AGENT_GUARD_DIR: records, PATH: bin + delimiter + process.env.PATH };
  delete env.CLAUDE_CODE_REMOTE;
  if (remote !== undefined) env.CLAUDE_CODE_REMOTE = remote;
  const event = { hook_event_name: mode === "session-start" ? "SessionStart" : "PreToolUse", session_id: "s1", cwd: root, tool_name: "Bash", tool_input: { command: "git push --force origin main" } };
  const r = spawnSync("node", [guard, mode], { encoding: "utf8", env, input: JSON.stringify(event) });
  return { r, records, ghCalls };
}

describe("guard.mjs outside a cloud session", () => {
  for (const mode of ["session-start", "pre-tool-use"]) {
    for (const remote of [undefined, "false"]) {
      test(`${mode} with CLAUDE_CODE_REMOTE ${remote === undefined ? "unset" : `"${remote}"`} does nothing`, () => {
        const { r, records, ghCalls } = run(mode, remote);
        assert.equal(r.status, 0, r.stderr);
        assert.equal(r.stdout, "", "no deny or other output");
        assert.equal(existsSync(ghCalls), false, "no gh calls");
        assert.deepEqual(readdirSync(records), [], "no session record written");
      });
    }
  }
});
