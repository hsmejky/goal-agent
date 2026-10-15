// The Goal agent guard: one program behind Claude Code's hook protocol (R45).
//   guard.mjs session-start   reads the State issue(s) once and writes the session record
//   guard.mjs pre-tool-use    reads the record and denies or allows the tool call
// Fails closed: anything unexpected at PreToolUse denies the tool.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { readIdentity } from "./identity.mjs";
import { readStateIssues } from "./state-issues.mjs";
import { hasHaltMarker } from "./halt-marker.mjs";
import { readRecord, writeRecord } from "./session-record.mjs";
import { decide } from "./rules.mjs";

function gitRoot(cwd) {
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" });
  if (r.error || r.status !== 0) throw new Error("cannot find the Home repo root");
  return r.stdout.trim();
}

/** Compute the verdict. Any error means Halted (fail closed). */
export function computeRecord(cwd) {
  try {
    const identity = readIdentity(cwd);
    const issues = readStateIssues(identity.home, identity.agent, { cwd });
    const marked = issues.filter((i) => hasHaltMarker(i.body));
    return { ...identity, root: gitRoot(cwd), halted: marked.length > 0, reason: marked.length ? `State issue #${marked[0].number} carries the halt marker` : undefined };
  } catch (e) {
    return { halted: true, reason: `could not read the State issue (${e.message})` };
  }
}

export function sessionStart(event) {
  writeRecord(event.session_id, computeRecord(event.cwd || process.cwd()));
}

/** The hook output for a PreToolUse event: a deny object, or null to allow. */
export function preToolUse(event) {
  let reason;
  try {
    const record = readRecord(event.session_id);
    reason = record ? decide(event, record) : "Goal agent guard has no session record for this session; denying every tool.";
  } catch (e) {
    reason = `Goal agent guard failed (${e.message}); denying the tool.`;
  }
  if (!reason) return null;
  return { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } };
}

function main(mode) {
  let event = {};
  try { event = JSON.parse(readFileSync(0, "utf8") || "{}"); } catch { /* an unreadable event fails closed below */ }
  if (mode === "session-start") {
    sessionStart(event);
  } else if (mode === "pre-tool-use") {
    const out = preToolUse(event);
    if (out) process.stdout.write(JSON.stringify(out));
  } else {
    process.stderr.write(`goal-agent guard: unknown mode ${mode}\n`);
    process.exit(2);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(process.argv[2]); } catch (e) {
    process.stderr.write(`goal-agent guard error: ${e.message}\n`);
    process.exit(2);
  }
}
