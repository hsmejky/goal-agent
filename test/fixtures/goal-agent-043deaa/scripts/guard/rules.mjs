// PreToolUse decisions. Each rule returns a deny reason or null; the first reason wins.
// Deny rules (#62) and push rules (#63) are added to RULES. `record` is the session record.
const halted = (event, record) =>
  record.halted ? `Goal agent is Halted: ${record.reason ?? "the State issue carries the halt marker"}. No tool may run.` : null;

import { DENY_RULES } from "./deny-rules.mjs";
import { pushRule } from "./push-rules.mjs";

export const RULES = [halted, ...DENY_RULES, pushRule];

/** A deny reason, or null to allow. */
export function decide(event, record) {
  for (const rule of RULES) {
    const reason = rule(event, record);
    if (reason) return reason;
  }
  return null;
}
