// Pin move (R59, ADR 0008-0011): one local command that moves every Home repo the Roster lists to a goal-agent
// commit. Started by the user with `node scripts/home/pin-move.mjs <sha> [--dry-run]`: renders each Home repo at the
// target with the target's own renderer and opens one PR (`goal-agent-sync-<sha12>`, "Move goal-agent pin to
// <sha12>") in every repo that differs, with the user's `gh` token, so the PR's workflows start at once.
// Order: token (and its `workflow` scope), the target's form and its place on goal-agent's main, the target fetched
// once, the Roster read at main, each definition at its Home repo's default branch, then each Home repo in Roster
// order. One repo's skip or error never stops the others; the report is one row per repo and the exit status is 0
// only when none was skipped or failed.
// Token: from `gh auth token`; the scopes come from the `X-Oauth-Scopes` header of `gh api -i user`. A classic token
// must list `workflow`; a header that is absent is a fine-grained token, accepted (GitHub tells no scopes then). The
// token goes to git only as a per-command `http.extraheader` (`-c`, never stored in git config) for reading (clone,
// ls-remote) and pushing the Home repos, which may be private; it is never printed.
// Options: --dry-run (accepted, but the command stops before any read until #152 implements it), --source <dir> (a goal-agent checkout at the target, skips the
// fetch), --remote <url> (where to fetch goal-agent from) and --remotes <dir> (clone and push `<dir>/<owner>/<repo>.git`
// instead of GitHub), all three for tests.
import { mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { GhError, ghApi } from "../lib/github.mjs";
import { checkTarget, fetchSource, git, lackingFunctions, optionValue, syncHome } from "./sync.mjs";

const SOURCE_REPO = "hsmejky/goal-agent";
const ROSTER = "docs/home-repos.md";
const RENDERER_FUNCTIONS = ["adoptFiles", "compareHome", "fsTree", "formatDrift"];

const OPTIONS_WITH_VALUE = ["--source", "--remote", "--remotes"];

function gh(args) {
  // the arguments are constants; on Windows `gh` may be a .cmd shim, which only a shell resolves
  const r = spawnSync("gh", args, { encoding: "utf8", shell: process.platform === "win32" });
  if (r.error) throw r.error;
  return r;
}

/** The user's token from `gh`; throws, without echoing the token, when it is missing or classic without `workflow`. */
export function userToken() {
  const t = gh(["auth", "token"]);
  const token = t.status === 0 ? t.stdout.trim() : "";
  if (!token) throw new Error("refused: no gh token; run `gh auth login` with the `workflow` scope");
  const header = /^x-oauth-scopes:[ \t]*(.*)$/im.exec(gh(["api", "-i", "user"]).stdout);
  if (header && !header[1].split(",").map((s) => s.trim()).includes("workflow")) {
    throw new Error(`refused: the gh token lacks the \`workflow\` scope (it has: ${header[1].trim() || "none"}); run \`gh auth refresh -s workflow\``);
  }
  return token;
}

/** The Roster's rows: { name, home } for each readable one, { unreadable } (the row's text) for the rest. */
export function parseRoster(text) {
  const lines = (text ?? "").split(/\r?\n/);
  const header = lines.findIndex((l) => /^\|\s*Goal agent\s*\|\s*Home repo\s*\|\s*$/.test(l));
  if (header < 0) return [];
  const rows = [];
  for (const line of lines.slice(header + 1)) {
    if (!line.startsWith("|")) break;
    if (/^\|[\s:|-]+\|\s*$/.test(line)) continue;
    const m = /^\|\s*`([a-z0-9-]+)`\s*\|\s*`([\w.-]+\/[\w.-]+)`\s*\|\s*$/.exec(line);
    rows.push(m ? { name: m[1], home: m[2] } : { unreadable: line });
  }
  return rows;
}

/** The text of `path` in `repo` (at `ref`, else the default branch), or null when it is not there. */
function readFile(repo, path, ref) {
  try {
    const file = ghApi(`repos/${repo}/contents/${path}${ref ? `?ref=${ref}` : ""}`);
    return typeof file?.content === "string" ? Buffer.from(file.content, "base64").toString("utf8") : null;
  } catch (e) {
    if (e instanceof GhError && e.status === 404) return null;
    throw e;
  }
}

function prBody({ sha, oldPin, drift, formatDrift }) {
  return [
    `Moves this Home repo from \`${oldPin ?? "an unknown pin"}\` to goal-agent \`${sha}\` (R59): \`goal-agent-pin\`, every \`uses:\` SHA, the adopted text, the callers, the guard copy and the settings.`,
    "",
    "This PR is part of one Pin move. Merge it when its drift check passes; the shared pin is broken until every PR of the Pin move is merged (any order, one sitting advised).",
    ...(drift.length ? ["", "## Left for you", "", "The generator cannot resolve these differences from the skeleton; the drift check fails until they are fixed in this PR:", "", "```text", formatDrift(drift), "```"] : []),
  ].join("\n");
}

/** A report cell: one line, with `|` escaped so it cannot split the Markdown table row. */
const cell = (s) => String(s).replace(/\s+/g, " ").trim().replaceAll("|", "\\|");

/** The target: the one positional argument (the options' values are not positional). */
function positional(argv) {
  return argv.find((a, i) => !a.startsWith("--") && !OPTIONS_WITH_VALUE.includes(argv[i - 1]));
}

/** One Home repo: clone it, render at the target, push and open the PR. Returns { pin, status, detail }. */
async function moveHome({ name, home }, { target, render, sourceDir, remotes, token, work }) {
  if (readFile(home, `.claude/agents/${name}.md`) === null) return { pin: "-", status: "skipped", detail: `no Home repo or no definition at ${home}/.claude/agents/${name}.md` };
  // autocrlf off: the clone holds the repo's bytes, which is what the render compares and the PR commits
  const env = { ...process.env, GH_TOKEN: token };
  const dir = join(work, home.replace("/", "--"));
  const url = remotes ? pathToFileURL(join(remotes, `${home}.git`)).href : `https://github.com/${home}.git`;
  git(work, ["clone", "-q", "--depth", "1", "-c", "core.autocrlf=false", url, dir], { env, token: true, bot: false });
  const prSpec = ({ oldPin, drift }) => ({
    title: `Move goal-agent pin to ${target.slice(0, 12)}`,
    message: `Move goal-agent pin to ${target.slice(0, 12)}\n\nMoves the Home repo to goal-agent ${target}.`,
    body: prBody({ sha: target, oldPin, drift, formatDrift: render.formatDrift }),
  });
  const result = await syncHome({ homeDir: dir, name, target, render, sourceDir, repo: home, env, describe: prSpec, bot: false });
  return { pin: result.oldPin ?? "unknown", ...(result.changed ? { status: "PR opened", detail: result.url } : { status: "no change", detail: "" }) };
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes("--dry-run")) throw new Error("--dry-run is not implemented yet (#152); nothing was read or pushed");
  const token = userToken();
  const target = positional(argv);
  checkTarget(target);

  const given = optionValue(argv, "--source");
  const sourceDir = given ? resolve(given) : fetchSource(target, optionValue(argv, "--remote") ?? `https://github.com/${SOURCE_REPO}.git`);
  const work = mkdtempSync(join(tmpdir(), "pin-move-"));
  try {
    const render = await import(pathToFileURL(join(sourceDir, "scripts/render/render.mjs")).href);
    const lacking = lackingFunctions(render, RENDERER_FUNCTIONS);
    if (lacking.length) throw new Error(`refused: ${target} has a renderer without ${lacking.join(", ")}`);

    const roster = readFile(SOURCE_REPO, ROSTER, "main");
    if (roster === null) throw new Error(`refused: ${ROSTER} not found at goal-agent's main`);
    const remotesDir = optionValue(argv, "--remotes");
    const remotes = remotesDir && resolve(remotesDir);
    const rows = [];
    for (const entry of parseRoster(roster)) {
      if (entry.unreadable) { rows.push({ repo: `Roster row ${entry.unreadable}`, role: "-", pin: "-", status: "skipped", detail: "the Roster row cannot be read" }); continue; }
      try {
        rows.push({ repo: entry.home, role: "Home repo", ...await moveHome(entry, { target, render, sourceDir, remotes, token, work }) });
      } catch (e) {
        rows.push({ repo: entry.home, role: "Home repo", pin: "-", status: "error", detail: e.message });
      }
    }
    console.log("| Repo | Role | Pin on main | Outcome |\n|---|---|---|---|");
    for (const r of rows) console.log(`| ${cell(r.repo)} | ${r.role} | ${cell(r.pin)} | ${cell(r.detail ? `${r.status}: ${r.detail}` : r.status)} |`);
    return rows.every((r) => r.status === "PR opened" || r.status === "no change") ? 0 : 1;
  } finally {
    rmSync(work, { recursive: true, force: true });
    if (!given) rmSync(sourceDir, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => { process.exitCode = code; }, (e) => { console.error(`pin move failed: ${e.message}`); process.exitCode = 1; });
}
