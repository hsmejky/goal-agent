// Home repo sync generator (R59). Started by hand in a Home repo with one input, a target goal-agent commit:
// renders the adopted text, the callers, the guard copy and the settings at that commit (scripts/render/render.mjs
// of the target), sets `goal-agent-pin` and every `uses:` SHA to it, and opens one PR with the job's GITHUB_TOKEN.
// The target must be a full 40-hex SHA reachable from goal-agent's main: the compare API says `behind` or
// `identical` for main...<sha>. Anything else is refused before the Home repo is touched.
// The renderer runs from the target commit, not from this script's own commit (the one `uses:` named): the sync
// is the one place where the two differ, and reachability from main is what makes the target code reviewed.
// Writes: one branch and one PR in the Home repo. A PR opened with GITHUB_TOKEN starts no workflows (GitHub's rule).
// Environment: GITHUB_REPOSITORY, TARGET (the commit), GH_TOKEN (the job's GITHUB_TOKEN), optional GOAL_AGENT_NAME.
// Options: --home <dir> (the Home repo checkout; default: the working directory), --source <dir> (a goal-agent
// checkout at the target, skips the fetch) and --remote <url> (where to fetch goal-agent from), all for tests.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { GhError, ghApi } from "../lib/github.mjs";
import { agentName } from "./lib.mjs";

const SOURCE_REPO = "hsmejky/goal-agent";
const SHA = /^[0-9a-f]{40}$/;
const BOT = ["-c", "user.name=github-actions[bot]", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com"];

/** The value after `name` in `argv`, or undefined. */
export function optionValue(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

/** The path after `name` in `argv`, resolved, else `fallback`. */
function pathOption(argv, name, fallback) {
  const value = optionValue(argv, name);
  return value ? resolve(value) : fallback;
}

/** The names in `names` that `render` (a target's renderer module) does not export as functions. */
export function lackingFunctions(render, names) {
  return names.filter((f) => typeof render[f] !== "function");
}

/** `git <args>` in `cwd`; `bot` commits as the Actions bot (the dispatch), else as the git identity in effect. */
export function git(cwd, args, { env = process.env, token = false, bot = true } = {}) {
  const auth = token && env.GH_TOKEN ? ["-c", `http.https://github.com/.extraheader=AUTHORIZATION: basic ${Buffer.from(`x-access-token:${env.GH_TOKEN}`).toString("base64")}`] : [];
  const r = spawnSync("git", [...(bot ? BOT : []), ...auth, ...args], { cwd, encoding: "utf8" });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`git ${args[0]} failed: ${(r.stderr || r.stdout).trim().replaceAll(env.GH_TOKEN || "\0", "***")}`);
  return r.stdout;
}

/** Throws unless `target` is a full SHA that goal-agent's main contains. */
export function checkTarget(target) {
  if (!SHA.test(target ?? "")) throw new Error(`refused: the target must be a full 40-hex commit SHA, got ${JSON.stringify(target ?? "")}`);
  let status = null;
  try { status = ghApi(`repos/${SOURCE_REPO}/compare/main...${target}`)?.status ?? null; } catch (e) { if (!(e instanceof GhError) || e.status !== 404) throw e; }
  if (status !== "behind" && status !== "identical") throw new Error(`refused: ${target} is not on goal-agent's main (compare status: ${status ?? "unknown commit"})`);
}

/** goal-agent at `sha`, fetched into a new directory. */
export function fetchSource(sha, remote) {
  const dir = mkdtempSync(join(tmpdir(), "goal-agent-"));
  git(dir, ["init", "-q"]);
  git(dir, ["fetch", "-q", "--depth", "1", remote, sha]);
  git(dir, ["checkout", "-q", "FETCH_HEAD"]);
  if (git(dir, ["rev-parse", "HEAD"]).trim() !== sha) throw new Error(`fetched commit is not ${sha}`);
  return dir;
}

/** The `owner/repo` lines of the definition's `## Covered repos` list. */
function coveredRepos(definition) {
  const body = /^## Covered repos\n([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(definition)?.[1] ?? "";
  return [...body.matchAll(/^- ([\w.-]+\/[\w.-]+)\s*$/gm)].map((m) => m[1]);
}

/** The Home repos of a Covered repo's registry table (`| \`name\` | \`label\` | \`owner/repo\` |` rows). */
export function registryHomes(text) {
  return [...(text ?? "").matchAll(/^\|\s*`[a-z0-9-]+`\s*\|[^|\n]*\|\s*`([\w.-]+\/[\w.-]+)`\s*\|/gm)].map((m) => m[1]);
}

/**
 * The Home repos other than `self` that cover the Covered repos, read from each registry over REST (public
 * repos). Advisory text for the PR body, so fail-soft: a registry that cannot be read gives a line in
 * `unread` instead of aborting the sync.
 */
export function otherHomeRepos(covered, self, read = readRegistry) {
  const homes = new Map();
  const unread = [];
  for (const repo of covered) {
    try {
      for (const home of registryHomes(read(repo))) if (home !== self) homes.set(home, [...(homes.get(home) ?? []), repo]);
    } catch (e) {
      unread.push(`${repo}: ${e.message.split("\n")[0]}`);
    }
  }
  return { homes, unread };
}

function readRegistry(repo) {
  const file = ghApi(`repos/${repo}/contents/docs/agents/goal-agents.md`);
  if (typeof file?.content !== "string") throw new Error("registry is not a file");
  return Buffer.from(file.content, "base64").toString("utf8");
}

function otherHomesLines({ sha, homes, unread }) {
  const lines = [...homes].map(([home, repos]) => `- [ ] \`${home}\` (covers ${repos.map((r) => `\`${r}\``).join(", ")}): run the sync there with the same target \`${sha}\`, so every Home repo covering a Covered repo holds the same pin.`);
  if (lines.length === 0 && unread.length === 0) lines.push("- [ ] No other Home repos found in the Covered repos' registries (`docs/agents/goal-agents.md`).");
  for (const u of unread) lines.push(`- [ ] Could not read the registry of ${u}: look in its \`docs/agents/goal-agents.md\` for other Home repos, and run the sync in each with the same target \`${sha}\`.`);
  return lines;
}

function prBody({ sha, oldPin, covered, others, drift, formatDrift }) {
  const steps = covered.map((repo) => `- [ ] \`${repo}\`: PR that sets the \`uses:\` SHA in \`.github/workflows/goal-agent-review.yml\` and \`.github/workflows/goal-agent-consult.yml\` to \`${sha}\` (two lines each; the registry in \`docs/agents/goal-agents.md\` there lists the Home repos covering it).`);
  return [
    `Brings this Home repo from \`${oldPin ?? "an unknown pin"}\` to goal-agent \`${sha}\` (R59): \`goal-agent-pin\`, every \`uses:\` SHA, the adopted text, the callers, the guard copy and the settings.`,
    "",
    "## Start the drift check before merging",
    "",
    "This PR was opened with `GITHUB_TOKEN`, so it starts no workflows. Close and reopen it, or push a commit to its branch, to start the drift check, and merge only when that passes. The sync needs the repo setting \"Allow GitHub Actions to create pull requests\".",
    "",
    "## Hand steps",
    "",
    ...(steps.length ? steps : ["- [ ] No Covered repos found in the definition: check `## Covered repos`."]),
    ...otherHomesLines({ sha, ...others }),
    "- [ ] Merge the Covered repo PRs and the other Home repos' PRs in one sitting.",
    ...(drift.length ? ["", "## Left for you", "", "The generator cannot resolve these differences from the skeleton; the drift check fails until they are fixed in this PR:", "", "```text", formatDrift(drift), "```"] : []),
  ].join("\n");
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const homeDir = pathOption(argv, "--home", process.cwd());
  const target = env.TARGET;
  checkTarget(target);

  const given = pathOption(argv, "--source", null);
  const remote = optionValue(argv, "--remote") ?? `https://github.com/${SOURCE_REPO}.git`;
  const sourceDir = given ?? fetchSource(target, remote);
  try {
    return await sync({ homeDir, target, sourceDir, env });
  } finally {
    if (!given) rmSync(sourceDir, { recursive: true, force: true });
  }
}

async function sync({ homeDir, target, sourceDir, env }) {
  const render = await import(pathToFileURL(join(sourceDir, "scripts/render/render.mjs")).href);
  if (lackingFunctions(render, ["adoptFiles"]).length) throw new Error(`refused: ${target} predates the sync generator (no adoptFiles in its renderer)`);
  const result = await syncHome({ homeDir, name: agentName(homeDir, env), target, render, sourceDir, repo: env.GITHUB_REPOSITORY, env, describe: dispatchPr(target, env.GITHUB_REPOSITORY) });
  if (!result.changed) console.log(`sync: the Home repo is already at ${target}`);
  else console.log(`sync: opened ${result.url}; it starts no workflows, so close and reopen it to start the drift check`);
  return 0;
}

/** The dispatch's PR: the Actions bot's commit and the body with its hand steps (retires with the dispatch, #154). */
function dispatchPr(sha, repo) {
  return ({ before, oldPin, drift, render }) => {
    const covered = coveredRepos(before ?? "");
    return {
      title: `Re-adopt goal-agent at ${sha.slice(0, 12)}`,
      message: `Re-adopt goal-agent at ${sha}`,
      body: prBody({ sha, oldPin, covered, others: otherHomeRepos(covered, repo), drift, formatDrift: render.formatDrift }),
    };
  };
}

/**
 * Render one Home repo checkout (`homeDir`, on its default branch) at `target` with `render`, the renderer in
 * `sourceDir`, commit what changed on `goal-agent-sync-<sha12>`, push it and open the PR in `repo`. `describe`
 * gives the PR's title, commit message and body. Returns { changed: false, oldPin } for a repo already at the
 * target, else { changed: true, oldPin, url }. `bot` picks the commit's author (see `git`).
 */
export async function syncHome({ homeDir, name, target, render, sourceDir, repo, env, describe, bot = true }) {
  const source = render.fsTree(sourceDir);
  const before = render.fsTree(homeDir).read(`.claude/agents/${name}.md`);
  const oldPin = /^goal-agent-pin:\s*(\S+)/m.exec(before ?? "")?.[1];
  const files = render.adoptFiles({ source, home: render.fsTree(homeDir), name, pin: target, homeRepo: repo });
  for (const [path, text] of Object.entries(files)) {
    if (text === null) rmSync(join(homeDir, path), { force: true });
    else { mkdirSync(dirname(join(homeDir, path)), { recursive: true }); writeFileSync(join(homeDir, path), text); }
  }
  if (git(homeDir, ["status", "--porcelain"], { bot }).trim() === "") return { changed: false, oldPin };

  const drift = render.compareHome({ source, home: render.fsTree(homeDir), name });
  const base = git(homeDir, ["rev-parse", "--abbrev-ref", "HEAD"], { bot }).trim();
  const branch = `goal-agent-sync-${target.slice(0, 12)}`;
  if (git(homeDir, ["ls-remote", "--heads", "origin", branch], { env, token: true, bot }).trim() !== "") {
    throw new Error(`refused: branch ${branch} already exists in the Home repo; close the earlier sync PR and delete that branch, then run the sync again`);
  }
  const { title, message, body } = describe({ before, oldPin, drift, render });
  git(homeDir, ["checkout", "-q", "-b", branch], { bot });
  git(homeDir, ["add", "-A"], { bot });
  git(homeDir, ["commit", "-q", "-m", message], { bot });
  git(homeDir, ["push", "-q", "origin", branch], { env, token: true, bot });
  const pr = ghApi(`repos/${repo}/pulls`, { method: "POST", body: { title, head: branch, base, body } });
  return { changed: true, oldPin, url: pr.html_url ?? `#${pr.number}` };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => { process.exitCode = code; }, (e) => { console.error(`sync failed: ${e.message}`); process.exitCode = 1; });
}
