// Push rules (R45, #63): a `git push` is allowed only as its own plain command, to the Home repo's
// `main`, without rewriting history, and only when every commit it would publish (the commits
// between origin/main and the pushed ref) touches nothing outside `memory/`. Self-contained: the
// only export is `pushRule`, a RULES entry. Fails closed on anything it cannot judge.
import { spawnSync } from "node:child_process";

const MEMORY = "memory/";
const SHELL_META = /[;&|<>`$()\n\r\\'"{}*?!#~]/;
const FLAG_OK = new Set(["-q", "--quiet", "-v", "--verbose"]);
const MAIN_DEST = new Set(["main", "refs/heads/main"]);

const git = (cwd, args) => spawnSync("git", args, { cwd, encoding: "utf8" });

const SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh", "eval", "xargs"]);
const words = (text) => text.split(/[\s;&|()`'"{}$<>]+/);

/**
 * Text inside quotes is data, not a command, so it is blanked out before looking for `git push`
 * -- except double-quoted text containing a substitution (`$(` or a backtick), which still runs.
 */
function withoutQuotedText(command) {
  return command
    .replace(/'[^']*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, (q) => (/\$\(|`/.test(q) ? q : '""'));
}

function isPushCommand(command) {
  const outer = words(withoutQuotedText(command));
  if (outer.includes("git") && outer.includes("push")) return true;
  // A shell wrapper (`bash -c '...'`) runs its quoted argument, so look inside the quotes too.
  const all = words(command);
  return outer.some((w) => SHELLS.has(w)) && all.includes("git") && all.includes("push");
}

/** The ref to publish, or a deny reason. */
function parsePush(command, cwd) {
  if (SHELL_META.test(command)) return { deny: "A git push must be its own plain command: no chaining, redirects, quoting or substitution." };
  const tokens = command.trim().split(/\s+/);
  if (tokens[0] !== "git" || tokens[1] !== "push") return { deny: "A git push must be its own plain command: `git push [origin] [main]`." };
  const args = [];
  for (const t of tokens.slice(2)) {
    if (t.startsWith("-")) {
      if (!FLAG_OK.has(t)) return { deny: `git push option ${t} is not allowed (no force, delete or other history-rewriting pushes).` };
    } else args.push(t);
  }
  if (args.length > 2) return { deny: "git push takes at most a remote and one refspec." };
  if (args.length && args[0] !== "origin") return { deny: "git push may target only origin." };
  const spec = args[1];
  if (spec === undefined) {
    const cur = git(cwd, ["symbolic-ref", "--short", "-q", "HEAD"]);
    if (cur.status !== 0 || cur.stdout.trim() !== "main") return { deny: "git push without a refspec is allowed only from the main branch." };
    return { ref: "main" };
  }
  if (spec.startsWith("+")) return { deny: "A forced refspec (+) is not allowed." };
  const [src, dst, ...rest] = spec.split(":");
  if (rest.length || !src) return { deny: "A push that deletes a ref or has a malformed refspec is not allowed." };
  if (!MAIN_DEST.has(dst ?? src)) return { deny: "git push may target only main." };
  return { ref: src };
}

function pushDeny(command, cwd) {
  const parsed = parsePush(command, cwd);
  if (parsed.deny) return parsed.deny;
  const range = `origin/main..${parsed.ref}`;
  const resolves = (r) => git(cwd, ["rev-parse", "--verify", "-q", `${r}^{commit}`]).status === 0;
  if (!resolves("origin/main") || !resolves(parsed.ref)) return `Could not resolve origin/main or ${parsed.ref}; denying the push.`;
  const log = git(cwd, ["log", "-m", "--no-renames", "--name-only", "-z", "--format=", range, "--"]);
  if (log.status !== 0) return `Could not list the commits to push (${range}); denying the push.`;
  const files = log.stdout.split("\0").filter(Boolean);
  const outside = files.filter((f) => !f.startsWith(MEMORY));
  if (outside.length) return `git push would publish commits touching files outside ${MEMORY}: ${[...new Set(outside)].slice(0, 5).join(", ")}. The agent may push only memory.`;
  return null;
}

export const pushRule = (event) => {
  if (event.tool_name !== "Bash") return null;
  const command = event.tool_input?.command;
  if (typeof command !== "string" || !isPushCommand(command)) return null;
  try {
    return pushDeny(command, event.cwd || process.cwd());
  } catch (e) {
    return `Could not judge the git push (${e.message}); denying it.`;
  }
};
