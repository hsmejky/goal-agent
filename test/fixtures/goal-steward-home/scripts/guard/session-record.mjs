// The session record: SessionStart writes the verdict, every PreToolUse reads it (R45). It lives
// outside the repo tree, keyed by session id. Later rules can add fields to the record.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const recordDir = () => process.env.GOAL_AGENT_GUARD_DIR || join(tmpdir(), "goal-agent-guard");

function recordPath(sessionId) {
  if (typeof sessionId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(sessionId)) throw new Error("missing or unsafe session id");
  return join(recordDir(), `${sessionId}.json`);
}

export function writeRecord(sessionId, record) {
  const p = recordPath(sessionId);
  mkdirSync(recordDir(), { recursive: true });
  writeFileSync(p, JSON.stringify({ version: 1, ...record }));
}

/** The record, or null when missing, unreadable or malformed (the caller fails closed). */
export function readRecord(sessionId) {
  try {
    const rec = JSON.parse(readFileSync(recordPath(sessionId), "utf8"));
    return rec && rec.version === 1 && typeof rec.halted === "boolean" ? rec : null;
  } catch {
    return null;
  }
}
