// The rendering module (R59). Renders what re-adoption copies from goal-agent at one pin, and compares a repo
// against it. One module serves the Home repo drift check (scripts/home/drift-check.mjs), the gate's caller
// check (scripts/gate/gate.mjs) and the Home repo generator (#115).
//
// Interface:
//   fsTree(dir), overlay(tree, files)   trees: { read(path) -> string | null, list(prefix) -> paths }
//   compareHome({ source, home, name }) -> drift entries
//   compareCovered({ source, covered }) -> drift entries
//   renderText(markdown, pin), renderCoveredCaller(template, pin, names)
// A drift entry is { item, file, line, expected, actual }: `line` is 1-based in the compared file (null when the
// entry is about the whole file), and `expected` or `actual` is null when that side has no such line.
//
// `source` is goal-agent at the pin (design doc, templates/, scripts/guard/, scripts/lib/). The comparison rules
// are written in R59 ("Substitutions" and "Comparison rules"); test/render/render.test.mjs holds R59 to this code.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";

export const DESIGN = "docs/goal-agents-with-engineering-skills.md";
export const BLOB = "https://github.com/hsmejky/goal-agent/blob";
export const GUARD_DIRS = ["scripts/guard/", "scripts/lib/"];
export const HOME_CALLERS = ["goal-agent-audit.yml", "goal-agent-staleness.yml", "goal-agent-drift-check.yml"];
export const COVERED_CALLERS = ["goal-agent-review.yml", "goal-agent-consult.yml"];
const PIN_PLACEHOLDER = "<goal-agent-pin>";
const SAMPLE_PAIR = /^(\s*)GOAL_AGENT_GOAL_STEWARD_(FIRE_TOKEN|TRIGGER_ID):/;
const SHA = /^[0-9a-f]{40}$/;

const lf = (text) => text.replace(/\r\n/g, "\n");

// ---------------------------------------------------------------- trees

/** A tree over a directory. Paths use `/`; text is read as UTF-8 with CRLF normalised to LF. */
export function fsTree(dir) {
  const walk = (rel) => {
    const abs = join(dir, rel);
    if (!existsSync(abs)) return [];
    return readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
      const p = rel ? `${rel}/${e.name}` : e.name;
      return e.isDirectory() ? walk(p) : [p];
    });
  };
  return {
    read: (path) => (existsSync(join(dir, path)) ? lf(readFileSync(join(dir, path), "utf8")) : null),
    list: (prefix) => walk(prefix.replace(/\/$/, "")).sort(),
  };
}

/** `tree` with some files replaced (a string) or removed (null). For tests and the generator. */
export function overlay(tree, files) {
  const has = (p) => Object.hasOwn(files, p);
  return {
    read: (path) => (has(path) ? files[path] : tree.read(path)),
    list: (prefix) => {
      const extra = Object.keys(files).filter((p) => p.startsWith(prefix) && files[p] !== null);
      return [...new Set([...tree.list(prefix), ...extra])].filter((p) => !has(p) || files[p] !== null).sort();
    },
  };
}

// ---------------------------------------------------------------- substitutions

/** Reference-style link definitions (`[k]: target`) of a markdown text. */
function definitions(markdown) {
  const defs = new Map();
  for (const m of markdown.matchAll(/^\[([^\]]+)\]:\s*(\S+)\s*$/gm)) defs.set(m[1], m[2]);
  return defs;
}

/**
 * R59's substitutions on copied design text: `[Rn](#rn)` becomes `Rn`; every other link to the design (a
 * `#anchor`) and every reference-style link becomes an inline absolute link at the pin. A reference that points
 * outside the repo (an `https:` URL) keeps its URL. `defs` resolves reference-style links (from the design).
 */
export function renderText(markdown, pin, defs = new Map()) {
  const docs = (path) => `${BLOB}/${pin}/docs/${path}`;
  return markdown
    .replace(/\[R(\d+)\]\(#r\1\)/g, "R$1")
    .replace(/\]\(#([^)\s]+)\)/g, (_, anchor) => `](${docs(`${DESIGN.slice("docs/".length)}#${anchor}`)})`)
    .replace(/\[([^\]]+)\]\[([^\]]+)\]/g, (whole, text, key) => {
      const target = defs.get(key);
      if (target === undefined) return whole;
      return `[${text}](${/^[a-z]+:/.test(target) ? target : docs(target)})`;
    });
}

// ---------------------------------------------------------------- sources in the design

/** The body of the first fenced block of exactly `fence` backticks, tagged `markdown`, in `section`. */
function fencedBlock(design, heading, fence) {
  const lines = design.split("\n");
  const start = lines.findIndex((l) => l.startsWith(heading));
  if (start < 0) throw new Error(`the design has no "${heading}"`);
  const open = lines.findIndex((l, i) => i > start && l === `${fence}markdown`);
  const close = lines.findIndex((l, i) => i > open && l === fence);
  if (open < 0 || close < 0) throw new Error(`no ${fence}markdown block under "${heading}"`);
  return lines.slice(open + 1, close).join("\n");
}

/** The R59 checklists: from `### Adding a Covered repo` to the end of the paragraph under the drift check. */
function checklists(design) {
  const lines = design.split("\n");
  const start = lines.indexOf("### Adding a Covered repo");
  const last = lines.indexOf("### Checking a Covered repo's gate copy for drift");
  if (start < 0 || last < 0) throw new Error("the design has no R59 checklists");
  let i = last + 1;
  while (i < lines.length && lines[i] === "") i++;
  while (i < lines.length && lines[i] !== "") i++;
  return lines.slice(start, i).join("\n");
}

/** The adopted sources of `source`, rendered at `pin`. */
export function renderSources(source, pin) {
  const design = source.read(DESIGN);
  if (design === null) throw new Error(`the source has no ${DESIGN}`);
  const defs = definitions(design);
  const render = (text) => renderText(text, pin, defs);
  return {
    skeleton: render(fencedBlock(design, "## Appendix A", "```")),
    contract: render(fencedBlock(design, "## Appendix B", "````")),
    operations: render(fencedBlock(design, "## Appendix C", "```")),
    checklists: render(checklists(design)),
  };
}

// ---------------------------------------------------------------- line comparison

/** Numbered lines: [{ n, text }], n 1-based in the file the lines came from. */
const numbered = (text, from = 1) => text.split("\n").map((t, i) => ({ n: from + i, text: t }));
const trimEnd = (lines) => {
  const out = [...lines];
  while (out.length && out.at(-1).text.trim() === "") out.pop();
  return out;
};

/** A line diff (LCS) of `expected` text against numbered `actual` lines: one entry per line in only one side. */
function diffLines(item, file, expected, actual) {
  const a = trimEnd(numbered(expected)).map((l) => l.text);
  const b = trimEnd(actual);
  const m = a.length, n = b.length;
  const lcs = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) {
    lcs[i][j] = a[i] === b[j].text ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  }
  const out = [];
  let i = 0, j = 0;
  const at = () => (j < n ? b[j].n : (b.at(-1)?.n ?? 0) + 1);
  while (i < m || j < n) {
    if (i < m && j < n && a[i] === b[j].text) { i++; j++; }
    else if (j < n && (i === m || lcs[i][j + 1] >= lcs[i + 1][j])) { out.push({ item, file, line: b[j].n, expected: null, actual: b[j].text }); j++; }
    else { out.push({ item, file, line: at(), expected: a[i], actual: null }); i++; }
  }
  return out;
}

const missingFile = (item, file) => [{ item, file, line: null, expected: "the file", actual: null }];

/** `lines` without the paragraph after the first non-heading paragraph: the Home repo's legend (R59). */
function withoutLegend(lines) {
  let i = 0;
  const blank = (k) => k < lines.length && lines[k].text.trim() === "";
  const skipBlank = () => { while (blank(i)) i++; };
  const skipPara = () => { while (i < lines.length && !blank(i)) i++; };
  for (;;) {
    skipBlank();
    if (i >= lines.length) return lines;
    const heading = lines[i].text.startsWith("#");
    skipPara();
    if (!heading) break;
  }
  const from = i;
  skipBlank();
  skipPara();
  return [...lines.slice(0, from), ...lines.slice(i)];
}

/** The numbered lines of the `## ` section titled `title`, up to the next `## ` heading or the end. */
function section(text, title) {
  const lines = numbered(text);
  const start = lines.findIndex((l) => l.text === title);
  if (start < 0) return null;
  const end = lines.findIndex((l, k) => k > start && l.text.startsWith("## "));
  return lines.slice(start, end < 0 ? lines.length : end);
}

// ---------------------------------------------------------------- the definition skeleton

/** Frontmatter entries (a key line plus its indented continuation lines) and body paragraphs, numbered. */
function units(text) {
  const lines = numbered(text);
  if (lines[0]?.text !== "---") return { front: [], body: [] };
  const close = lines.findIndex((l, k) => k > 0 && l.text === "---");
  const front = [];
  for (const l of lines.slice(1, close)) {
    if (/^\s/.test(l.text) && front.length) front.at(-1).text += `\n${l.text}`;
    else front.push({ n: l.n, text: l.text });
  }
  const bodyEnd = lines.findIndex((l, k) => k > close && l.text.startsWith("## "));
  const body = [];
  let para = null;
  for (const l of lines.slice(close + 1, bodyEnd < 0 ? lines.length : bodyEnd)) {
    if (l.text.trim() === "") { para = null; continue; }
    if (para) para.text += `\n${l.text}`;
    else body.push((para = { n: l.n, text: l.text }));
  }
  return { front, body };
}

/** A skeleton unit as a matcher: verbatim, or with each `<...>` any non-empty text and whitespace runs one space. */
function matcher(unit) {
  if (!/<[^>]+>/.test(unit)) return (t) => t === unit;
  const ws = (s) => s.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
  const parts = unit.split(/<[^>]+>/);
  const re = new RegExp(`^${parts.map((p) => (p.trim() === "" ? "" : ws(p))).map((p, k) => {
    const lead = k > 0 && /^\s/.test(parts[k]) ? "\\s+" : "";
    const trail = k < parts.length - 1 && /\s$/.test(parts[k]) ? "\\s+" : "";
    return `${lead}${p}${trail}`;
  }).join("[\\s\\S]+?")}$`);
  return (t) => re.test(t.replace(/\s+$/, ""));
}

/** Each skeleton unit, in order, matches a later Home unit; extra Home units are allowed. */
function compareSkeleton(file, skeleton, text, pin) {
  const want = units(skeleton);
  const have = units(text);
  const out = [];
  for (const part of ["front", "body"]) {
    let k = 0;
    for (const u of want[part]) {
      const unit = u.text.startsWith("goal-agent-pin:") ? `goal-agent-pin: ${pin}` : u.text;
      const match = matcher(unit);
      const found = have[part].findIndex((h, idx) => idx >= k && match(h.text));
      if (found < 0) out.push({ item: "skeleton", file, line: have[part][k]?.n ?? null, expected: unit, actual: have[part][k]?.text ?? null });
      else k = found + 1;
    }
  }
  return out;
}

// ---------------------------------------------------------------- Home repo

const pinOf = (definition) => /^goal-agent-pin:\s*(\S+)\s*$/m.exec(definition ?? "")?.[1] ?? null;

/** Every `uses: hsmejky/goal-agent/...@<sha>` in `.github/workflows/` names `pin`. */
function compareUses(repo, pin) {
  const out = [];
  for (const file of repo.list(".github/workflows/")) {
    numbered(repo.read(file)).forEach(({ n, text }) => {
      const m = /uses:\s*hsmejky\/goal-agent\/\S*@(\S+)/.exec(text);
      if (m && m[1] !== pin) out.push({ item: "uses", file, line: n, expected: `@${pin}`, actual: text.trim() });
    });
  }
  return out;
}

/** The Home repo's guard copy: each file under scripts/guard/ and scripts/lib/ equals the source's. */
function compareGuard(source, home) {
  const out = [];
  for (const dir of GUARD_DIRS) {
    const want = source.list(dir), have = home.list(dir);
    for (const f of want) {
      const actual = home.read(f);
      if (actual === null) out.push(...missingFile("guard", f));
      else out.push(...diffLines("guard", f, source.read(f), numbered(actual)));
    }
    for (const f of have.filter((f) => !want.includes(f))) out.push({ item: "guard", file: f, line: null, expected: null, actual: "the file" });
  }
  return out;
}

/** Paths at which two JSON values differ. */
function jsonDiff(a, b, path = "") {
  if (isDeepStrictEqual(a, b)) return [];
  const obj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
  if (!obj(a) || !obj(b)) return [{ path: path || "/", a, b }];
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) => jsonDiff(a[k], b[k], `${path}/${k}`));
}

/** `.claude/settings.json` without `enabledPlugins` equals `templates/home-settings.json` as JSON. */
function compareSettings(source, home) {
  const file = ".claude/settings.json";
  const text = home.read(file);
  if (text === null) return missingFile("settings", file);
  let actual;
  try { actual = JSON.parse(text); } catch (e) { return [{ item: "settings", file, line: null, expected: "valid JSON", actual: e.message }]; }
  delete actual.enabledPlugins;
  const expected = JSON.parse(source.read("templates/home-settings.json"));
  return jsonDiff(expected, actual).map((d) => ({
    item: "settings", file, line: null,
    expected: d.a === undefined ? null : `${d.path}: ${JSON.stringify(d.a)}`,
    actual: d.b === undefined ? null : `${d.path}: ${JSON.stringify(d.b)}`,
  }));
}

/** A caller template at the pin compared with the repo's workflow of the same name. */
function compareCaller(repo, name, rendered) {
  const file = `.github/workflows/${name}`;
  const text = repo.read(file);
  return text === null ? missingFile("caller", file) : diffLines("caller", file, rendered, numbered(text));
}

/**
 * A Home repo (`home`) against goal-agent at its pin (`source`). `name` is the agent; the pin is the
 * `goal-agent-pin` of its definition.
 */
export function compareHome({ source, home, name }) {
  const defFile = `.claude/agents/${name}.md`;
  const definition = home.read(defFile);
  if (definition === null) return missingFile("skeleton", defFile);
  const pin = pinOf(definition);
  if (pin === null) return [{ item: "skeleton", file: defFile, line: null, expected: "goal-agent-pin: <pin>", actual: null }];
  const r = renderSources(source, pin);
  const out = [...compareSkeleton(defFile, r.skeleton, definition, pin)];

  const agents = home.read("docs/agents/goal-agents.md");
  if (agents === null) out.push(...missingFile("contract", "docs/agents/goal-agents.md"));
  else {
    const lines = numbered(agents);
    const split = lines.findIndex((l) => l.text === "## Checklists");
    const contract = split < 0 ? lines : lines.slice(0, split);
    out.push(...diffLines("contract", "docs/agents/goal-agents.md", r.contract, withoutLegend(contract)));
    const after = split < 0 ? [] : lines.slice(split + 1);
    const first = after.findIndex((l) => l.text.startsWith("### "));
    const end = after.findIndex((l) => l.text.startsWith("## "));
    const lists = first < 0 ? [] : after.slice(first, end < 0 ? after.length : end);
    out.push(...diffLines("checklists", "docs/agents/goal-agents.md", r.checklists, lists));
  }

  const tracker = home.read("docs/agents/issue-tracker.md");
  const ops = tracker === null ? null : section(tracker, "## Goal agent operations");
  if (ops === null) out.push(...missingFile("operations", "docs/agents/issue-tracker.md"));
  else out.push(...diffLines("operations", "docs/agents/issue-tracker.md", r.operations, withoutLegend(ops)));

  out.push(...compareGuard(source, home), ...compareSettings(source, home));
  for (const caller of HOME_CALLERS) {
    const template = source.read(`templates/${caller}`);
    if (template !== null) out.push(...compareCaller(home, caller, template.replaceAll(PIN_PLACEHOLDER, pin)));
  }
  out.push(...compareUses(home, pin));
  return out;
}

// ---------------------------------------------------------------- Covered repo

/** The Goal agent names of a Covered repo's registry (`docs/agents/goal-agents.md`), in table order. */
export function registryNames(text) {
  return [...(text ?? "").matchAll(/^\|\s*`([a-z0-9-]+)`\s*\|/gm)].map((m) => m[1]);
}

/** A Covered caller template at `pin`, with its sample secret pair replaced by one pair per agent in `names`. */
export function renderCoveredCaller(template, pin, names) {
  const lines = template.replaceAll(PIN_PLACEHOLDER, pin).split("\n");
  const at = lines.findIndex((l) => SAMPLE_PAIR.test(l));
  if (at < 0) return lines.join("\n");
  const sample = lines.filter((l) => SAMPLE_PAIR.test(l));
  const pairs = names.flatMap((name) => {
    const upper = name.toUpperCase().replaceAll("-", "_");
    return sample.map((l) => l.replaceAll("GOAL_AGENT_GOAL_STEWARD_", `GOAL_AGENT_${upper}_`));
  });
  const rest = lines.filter((l) => !SAMPLE_PAIR.test(l));
  rest.splice(at, 0, ...pairs);
  return rest.join("\n");
}

/**
 * A Covered repo's gate and Consultation callers (`covered`) against the templates of `source`. The pin is the
 * SHA in the gate caller's own `uses:` line; the agents are the repo's registry rows.
 */
export function compareCovered({ source, covered }) {
  const gate = covered.read(`.github/workflows/${COVERED_CALLERS[0]}`);
  if (gate === null) return missingFile("caller", `.github/workflows/${COVERED_CALLERS[0]}`);
  const pin = /uses:\s*hsmejky\/goal-agent\/\S*@(\S+)/.exec(gate)?.[1] ?? null;
  if (pin === null || !SHA.test(pin)) {
    return [{ item: "uses", file: `.github/workflows/${COVERED_CALLERS[0]}`, line: null, expected: "a full 40-hex goal-agent SHA", actual: pin }];
  }
  const names = registryNames(covered.read("docs/agents/goal-agents.md"));
  const out = [];
  for (const caller of COVERED_CALLERS) {
    out.push(...compareCaller(covered, caller, renderCoveredCaller(source.read(`templates/${caller}`), pin, names)));
  }
  return out;
}

/** Drift entries as text, one line each. */
export function formatDrift(drift) {
  return drift.map((d) => {
    const where = d.line === null ? d.file : `${d.file}:${d.line}`;
    const parts = [d.expected !== null ? `expected ${JSON.stringify(d.expected)}` : null, d.actual !== null ? `found ${JSON.stringify(d.actual)}` : null];
    return `${d.item}: ${where}: ${parts.filter(Boolean).join(", ")}`;
  }).join("\n");
}
