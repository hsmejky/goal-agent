// Tool and API deny rules (#62, R45). Each rule is (event, record) => deny reason | null.
// The record carries `root` (the Home repo working tree), `home` and `covered` (from origin/main).
import { realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { recordDir } from "./session-record.mjs";

// ---- Skill and MCP tools ---------------------------------------------------------------------

export const skillTool = (event) =>
  event.tool_name === "Skill" ? "The Skill tool is denied: a Goal agent works from its contract and definition, not Engineering skills." : null;

export const mcpTools = (event) => {
  const name = String(event.tool_name ?? "");
  if (!name.startsWith("mcp__")) return null;
  return name.split("__").pop() === "add_repo" ? null : `MCP tool ${name} is denied: only add_repo may be used.`;
};

// ---- File writes -----------------------------------------------------------------------------

const WRITE_TOOLS = new Set(["Edit", "Write", "NotebookEdit", "MultiEdit"]);
const fold = (p) => (process.platform === "win32" ? p.toLowerCase() : p);

/** Resolve symlinks of the deepest existing ancestor, then re-append the rest. */
function canonical(p) {
  let rest = "";
  let cur = resolve(p);
  for (;;) {
    try { return join(realpathSync.native(cur), rest); } catch {
      const up = dirname(cur);
      if (up === cur) return resolve(p);
      rest = join(cur.slice(up.length + 1), rest);
      cur = up;
    }
  }
}

/** True when `child` is `parent` or lies under it. */
const within = (parent, child) => {
  const rel = relative(fold(canonical(parent)), fold(canonical(child)));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

export function fileWrites(event, record) {
  if (!WRITE_TOOLS.has(event.tool_name)) return null;
  const input = event.tool_input ?? {};
  const target = input.file_path ?? input.notebook_path ?? input.path;
  if (typeof target !== "string" || !target) return `${event.tool_name} without a readable target path is denied.`;
  if (typeof record.root !== "string") throw new Error("session record has no Home repo root");
  const abs = resolve(event.cwd || record.root, target);
  if (within(recordDir(), abs)) return `${event.tool_name} on the guard's session record is denied.`;
  if (!within(record.root, abs)) return null; // outside the Home repo
  return within(join(record.root, "memory"), abs) ? null : `${event.tool_name} inside the Home repo is allowed only under memory/; denied: ${target}`;
}

// ---- Shell text ------------------------------------------------------------------------------

/** Split shell text into simple commands, each a list of words. Best effort. */
export function shellCommands(text) {
  const cmds = [];
  let cmd = [];
  let tok = "";
  let has = false;
  let q = null;
  const endTok = () => { if (has) cmd.push(tok); tok = ""; has = false; };
  const endCmd = () => { endTok(); if (cmd.length) cmds.push(cmd); cmd = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === q) q = null;
      else if (c === "\\" && q === '"' && i + 1 < text.length) tok += text[++i];
      else tok += c;
    } else if (c === "'" || c === '"') { q = c; has = true; }
    else if (c === "\\" && i + 1 < text.length) { tok += text[++i]; has = true; }
    else if (/\s/.test(c) && c !== "\n") endTok();
    else if (";&|\n()`".includes(c)) endCmd();
    else { tok += c; has = true; }
  }
  endCmd();
  return cmds;
}

const WRAPPERS = new Set(["env", "sudo", "command", "exec", "time", "nohup", "nice", "builtin", "then", "do", "else", "{", "!"]);
const SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh", "eval"]);
const base = (s) => s.replace(/^.*[\\/]/, "").replace(/\.(exe|cmd)$/i, "");

/** The command words with leading assignments and wrappers removed. */
function commandWords(words) {
  let i = 0;
  while (i < words.length) {
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i])) i++;
    else if (WRAPPERS.has(base(words[i]))) { i++; while (i < words.length && words[i].startsWith("-")) i++; }
    else break;
  }
  return words.slice(i);
}

/** Visit every simple command in `text`, descending into `bash -c "..."` style strings. */
function* simpleCommands(text, depth = 0) {
  for (const words of shellCommands(text)) {
    const w = commandWords(words);
    if (!w.length) continue;
    yield w;
    if (depth < 4 && SHELLS.has(base(w[0]))) for (const a of w.slice(1)) if (/\s/.test(a)) yield* simpleCommands(a, depth + 1);
  }
}

const positionals = (args, valued) => {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("-")) { if (valued.has(a)) i++; } else out.push(a);
  }
  return out;
};

export function isClone(w) {
  const cmd = base(w[0]);
  if (cmd === "git") return positionals(w.slice(1), new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"]))[0] === "clone";
  if (cmd === "gh") { const p = positionals(w.slice(1), new Set()); return p[0] === "repo" && p[1] === "clone"; }
  return false;
}

// ---- gh api ----------------------------------------------------------------------------------

const API_VALUED = new Set(["-X", "--method", "-f", "--raw-field", "-F", "--field", "--input", "-H", "--header", "-q", "--jq",
  "-t", "--template", "-p", "--preview", "--hostname", "--cache"]);

/** { path, method, hasBody, texts } of a `gh api` command (the words after `api`). */
export function parseGhApi(args) {
  let method = null;
  let hasBody = false;
  let path = null;
  const texts = [];
  for (let i = 0; i < args.length; i++) {
    let a = args[i];
    let val;
    const eq = /^(--[a-z-]+)=([\s\S]*)$/.exec(a);
    if (eq) { a = eq[1]; val = eq[2]; }
    else if (/^-[XfF][\s\S]+$/.test(a)) { val = a.slice(2); a = a.slice(0, 2); }
    if (API_VALUED.has(a)) {
      if (val === undefined) val = args[++i] ?? "";
      if (a === "-X" || a === "--method") method = val.toUpperCase();
      else if (["-f", "--raw-field", "-F", "--field"].includes(a)) { hasBody = true; texts.push(val); }
      else if (a === "--input") { hasBody = true; texts.push("@input"); }
    } else if (!a.startsWith("-") && path === null) path = a;
  }
  return { path, method, hasBody, texts };
}

const issuesPath = /^repos\/([^/]+)\/([^/]+)\/issues(\/.*)?$/i;

export function ghApiWrites(w, record) {
  const { path, method, hasBody, texts } = parseGhApi(w.slice(2));
  const p = (path ?? "").replace(/^\/+/, "").replace(/[?#].*$/, "");
  if (p.toLowerCase() === "graphql") {
    const opaque = texts.some((t) => /\bmutation\b/i.test(t) || t === "@input" || /^(query=)?@/.test(t));
    return opaque ? "GraphQL mutations are denied (and queries read from a file or --input cannot be checked)." : null;
  }
  const write = method ? method !== "GET" : hasBody;
  if (!write) return null;
  const m = issuesPath.exec(p);
  const safe = m && !p.split("/").includes("..") && !/[$`]/.test(p);
  const allowed = new Set([record.home, ...(record.covered ?? [])].map((r) => String(r).toLowerCase()));
  if (safe && allowed.has(`${m[1]}/${m[2]}`.toLowerCase())) return null;
  return `gh api write (${method ?? "POST"} ${path ?? "?"}) is denied: writes are allowed only under repos/<owner>/<repo>/issues of the Home repo or a Covered repo.`;
}

export function bashRules(event, record) {
  if (event.tool_name !== "Bash") return null;
  const command = event.tool_input?.command;
  if (typeof command !== "string") return "Bash without a readable command is denied.";
  for (const w of simpleCommands(command)) {
    if (isClone(w)) return "git clone and gh repo clone are denied: reach a Covered repo with add_repo and gh api.";
    if (base(w[0]) === "gh" && positionals(w.slice(1), new Set())[0] === "api") {
      const reason = ghApiWrites(w, record);
      if (reason) return reason;
    }
  }
  return null;
}

export const DENY_RULES = [skillTool, mcpTools, fileWrites, bashRules];
