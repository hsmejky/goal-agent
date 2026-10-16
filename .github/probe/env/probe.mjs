// TEMPORARY probe for #112. Prints, for each named variable, whether it is set, its length and the first
// 12 hex digits of its SHA-256 (never the value), so the caller job's direct hash can be compared.
import { createHash } from "node:crypto";
const names = ["GOAL_AGENT_GOAL_STEWARD_FIRE_TOKEN", "GOAL_AGENT_GOAL_STEWARD_TRIGGER_ID", "PROBE_PLAIN", "GH_TOKEN"];
for (const n of names) {
  const v = process.env[n];
  const h = v ? createHash("sha256").update(v).digest("hex").slice(0, 12) : "-";
  console.log(`${n}: ${v ? `set, length ${v.length}, sha256 ${h}` : "NOT SET"}`);
}
if (!process.env.GOAL_AGENT_GOAL_STEWARD_FIRE_TOKEN || !process.env.GOAL_AGENT_GOAL_STEWARD_TRIGGER_ID) process.exitCode = 1;
