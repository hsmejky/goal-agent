// Who is this guard guarding? Home repo from the origin remote, agent name and Covered repos from
// the single definition committed on origin/main (never the working tree, R45).
import { spawnSync } from "node:child_process";

const git = (args, cwd) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.error || r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${(r.stderr || r.error?.message || "").trim()}`);
  return r.stdout;
};

/** `owner/repo` from an https, ssh or proxy-style remote URL. */
export function parseRemote(url) {
  const m = /[\/:]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(url.trim());
  if (!m) throw new Error(`cannot read owner/repo from remote: ${url.trim()}`);
  return `${m[1]}/${m[2]}`;
}

/** The `- owner/repo` lines of the `## Covered repos` section only (R42). */
export function parseCoveredRepos(markdown) {
  const repos = [];
  let inSection = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^##\s/.test(line)) { inSection = /^##\s+Covered repos\s*$/.test(line); continue; }
    if (!inSection) continue;
    const m = /^- ([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\s*$/.exec(line);
    if (m) repos.push(m[1]);
  }
  return repos;
}

/** { home, agent, covered } for the repo at `cwd`. Throws unless there is exactly one definition. */
export function readIdentity(cwd) {
  const home = parseRemote(git(["remote", "get-url", "origin"], cwd));
  const files = git(["ls-tree", "--name-only", "origin/main", ".claude/agents/"], cwd)
    .split(/\r?\n/).filter((f) => f.endsWith(".md"));
  if (files.length !== 1) throw new Error(`expected exactly one definition in .claude/agents/ on origin/main, found ${files.length}`);
  const agent = files[0].replace(/^.*\//, "").replace(/\.md$/, "");
  if (!/^[a-z0-9-]+$/.test(agent)) throw new Error(`invalid agent name: ${agent}`);
  const covered = parseCoveredRepos(git(["show", `origin/main:${files[0]}`], cwd));
  return { home, agent, covered };
}
