// Test harness for the goal-agent scripts: a fake GitHub REST API behind fake `gh` and `curl`
// on the PATH. See README.md for usage. No dependencies beyond Node.
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { newState } from "./fake-github.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fwd = (p) => p.replaceAll("\\", "/");

export function createHarness(seed = {}) {
  const dir = mkdtempSync(join(tmpdir(), "goal-agent-harness-"));
  const shimDir = join(dir, "bin");
  const stateFile = join(dir, "state.json");
  writeFileSync(stateFile, JSON.stringify(newState(seed), null, 2));

  // One POSIX shim and one .cmd shim per fake tool, each calling this node binary on bin/<tool>.mjs.
  mkdirSync(shimDir, { recursive: true });
  for (const tool of ["gh", "curl"]) {
    const entry = join(here, "bin", `${tool}.mjs`);
    writeFileSync(join(shimDir, tool), `#!/bin/sh\nexec "${fwd(process.execPath)}" "${fwd(entry)}" "$@"\n`);
    chmodSync(join(shimDir, tool), 0o755);
    writeFileSync(join(shimDir, `${tool}.cmd`), `@"${process.execPath}" "${entry}" %*\r\n`);
  }

  const read = () => JSON.parse(readFileSync(stateFile, "utf8"));
  const pick = (kind) => read().writes.filter((w) => w.kind === kind).map(({ kind: _k, ...rest }) => rest);

  const harness = {
    dir,
    /** Current fake GitHub state (repos, issues, pulls, statuses ...). */
    get state() { return read(); },
    /** Writes the script made, grouped by kind. `all` keeps order and the `kind` field. */
    get writes() {
      return {
        statuses: pick("status"),
        comments: pick("comment"),
        issueEdits: pick("issue-edit"),
        newIssues: pick("issue-create"),
        newPulls: pick("pull-create"),
        labels: pick("label"),
        all: read().writes,
      };
    },
    /** Every curl invocation: { method, url, headers (lower-case names), body, responded }. */
    get fires() { return read().fires; },
    /** Every gh invocation's argv, in order (served or refused). */
    get ghCalls() { return read().ghCalls; },
    /** Calls the fakes refused (non-REST gh usage, unsupported routes). */
    get violations() { return read().violations; },
    /** Write a helper script into the harness temp dir and return its absolute path. */
    writeScript(name, content) {
      const p = join(dir, name);
      writeFileSync(p, content);
      return p;
    },
    /**
     * Run `command args` as a child process with the fakes first on PATH.
     * Returns { code, stdout, stderr }. Throws if the fakes recorded a violation,
     * unless `allowViolations` is set.
     */
    run(command, args = [], { env = {}, input, cwd, allowViolations = false } = {}) {
      const base = { ...process.env };
      for (const k of Object.keys(base)) if (k.toLowerCase() === "path") delete base[k];
      const childEnv = { ...base, ...env, PATH: [shimDir, process.env.PATH ?? process.env.Path ?? ""].join(delimiter), FAKE_GH_STATE: stateFile };
      const r = spawnSync(command, args, { env: childEnv, input, cwd, encoding: "utf8" });
      if (r.error) throw r.error;
      const result = { code: r.status, stdout: r.stdout, stderr: r.stderr };
      const violations = read().violations;
      if (violations.length && !allowViolations) {
        throw new Error(`fake gh refused ${violations.length} call(s):\n${violations.map((v) => `  ${v.message}`).join("\n")}\n--- script stderr ---\n${r.stderr}`);
      }
      return result;
    },
    cleanup() { rmSync(dir, { recursive: true, force: true }); },
  };
  return harness;
}
