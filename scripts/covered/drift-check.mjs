// Covered repo drift check (ADR 0011). Runs on every PR and every push to main of a Covered repo: compares the
// checked-out Covered repo's three callers (gate, Consultation, drift check) with goal-agent's templates rendered
// at the SHA of the gate caller's `uses:` line, for the repo's registry (the rules are R59's "Comparison rules",
// in scripts/render/render.mjs). Any drift prints every differing line and fails the run. Reads only the
// checkout: it writes nothing and opens no issue, on a PR or on a push.
// The source is goal-agent at this script's own commit, which the `uses:` rule holds to the pin.
// Options: --source <dir> (goal-agent checkout to compare with; default: this script's repo) and --covered <dir>
// (the Covered repo; default: the working directory), both for tests.
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compareCoveredDrift, formatDrift, fsTree } from "../render/render.mjs";

function option(argv, name, fallback) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? resolve(argv[i + 1]) : fallback;
}

export function main(argv = process.argv.slice(2)) {
  const sourceDir = option(argv, "--source", join(dirname(fileURLToPath(import.meta.url)), "../.."));
  const coveredDir = option(argv, "--covered", process.cwd());
  const drift = compareCoveredDrift({ source: fsTree(sourceDir), covered: fsTree(coveredDir) });
  if (drift.length === 0) {
    console.log("drift check: no drift");
    return 0;
  }
  console.error(`drift check: ${drift.length} differing line(s) from goal-agent at the pin:\n${formatDrift(drift)}`);
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.exitCode = main(); } catch (e) { console.error(`drift check failed: ${e.message}`); process.exitCode = 1; }
}
