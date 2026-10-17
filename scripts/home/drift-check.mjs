// Home repo drift check (R59). Runs on every PR and every push to main of a Home repo: compares the checked-out
// Home repo with goal-agent at the pin (the adopted text, the guard copy, the settings, the callers and every
// goal-agent `uses:` SHA; the rules are R59's "Comparison rules", in scripts/render/render.mjs). Any drift prints
// every differing line and fails the run; on a push to main it also opens one issue, and no other while that one
// is open. Writes nothing else.
// The source is goal-agent at this script's own commit, which the `uses:` rule holds to the pin.
// Environment: GITHUB_REPOSITORY, GITHUB_EVENT_NAME, optional GOAL_AGENT_NAME.
// Options: --source <dir> (goal-agent checkout to compare with; default: this script's repo) and --home <dir>
// (the Home repo; default: the working directory), both for tests.
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compareHome, formatDrift, fsTree } from "../render/render.mjs";
import { agentName, openOrComment } from "./lib.mjs";

export const DRIFT_MARKER = "<!-- goal-agent:drift -->";

function option(argv, name, fallback) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? resolve(argv[i + 1]) : fallback;
}

export function main(argv = process.argv.slice(2), env = process.env) {
  const sourceDir = option(argv, "--source", join(dirname(fileURLToPath(import.meta.url)), "../.."));
  const homeDir = option(argv, "--home", process.cwd());
  const name = agentName(homeDir, env);
  const drift = compareHome({ source: fsTree(sourceDir), home: fsTree(homeDir), name });
  if (drift.length === 0) {
    console.log("drift check: no drift");
    return 0;
  }
  const text = formatDrift(drift);
  console.error(`drift check: ${drift.length} differing line(s) from goal-agent at the pin:\n${text}`);
  if (env.GITHUB_EVENT_NAME === "push") {
    const body = `${name}'s Home repo differs from goal-agent at its \`goal-agent-pin\` (R59). Re-adopt, or fix the copy, until the drift check passes. This issue stays the only open report until it is closed.\n\n\`\`\`text\n${text}\n\`\`\``;
    const r = openOrComment(env.GITHUB_REPOSITORY, { marker: DRIFT_MARKER, title: `Goal agent ${name}: the Home repo has drifted from goal-agent`, body, quiet: true });
    console.error(`drift check: ${r.action === "none" ? "drift issue already open" : r.action} #${r.number}`);
  }
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.exitCode = main(); } catch (e) { console.error(`drift check failed: ${e.message}`); process.exitCode = 1; }
}
