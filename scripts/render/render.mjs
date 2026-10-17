// The rendering module (R59). Renders what re-adoption copies from goal-agent at one pin, and compares a repo
// against it. One module serves the Home repo drift check (scripts/home/drift-check.mjs), the gate's caller
// check (scripts/gate/gate.mjs) and the Home repo generator (#115).
//
// Interface:
//   fsTree(dir), overlay(tree, files)   trees: { read(path) -> string | null, list(prefix) -> paths }
//   compareHome({ source, home, name }) -> drift entries
//   compareCovered({ source, covered }) -> drift entries            (the gate's caller check: two callers)
//   compareCoveredDrift({ source, covered }) -> drift entries       (the Covered repo drift check: three callers)
//   renderCovered({ source, covered, pin, agents }) -> files        (a Covered repo's files for its Registry rows)
//   renderText(markdown, pin), renderCoveredCaller(template, pin, names)
// `agents` are the Registry rows `{ name, label, home }` in any order; renderCovered sorts them by name. Its result is
// a map of path to new text holding only the files that change: the three callers at `pin` with one secret pair per
// agent, the Registry section of docs/agents/goal-agents.md, and the agent lines of the `### Goal agents` block of
// CLAUDE.md (the block is created from Appendix E's text when missing). The rest of those two files stays byte for
// byte; a repo written with the result has no Covered repo drift (compareCoveredDrift).
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
// Directories goal-agent no longer distributes to a Home repo (they run from goal-agent at the pin
// since #110); a sync removes them.
export const RETIRED_DIRS = ["scripts/gate/", "scripts/home/"];
export const HOME_CALLERS = ["goal-agent-audit.yml", "goal-agent-staleness.yml", "goal-agent-drift-check.yml", "goal-agent-sync.yml"];
export const COVERED_CALLERS = ["goal-agent-review.yml", "goal-agent-consult.yml"];
// The Covered repo drift-check caller (ADR 0011): its template is named apart from the Home repo's, and both
// render to the workflow goal-agent-drift-check.yml (no repo is both a Home repo and a Covered repo).
export const COVERED_DRIFT_TEMPLATE = "goal-agent-covered-drift-check.yml";
export const COVERED_DRIFT_WORKFLOW = "goal-agent-drift-check.yml";
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

/** The body of the `nth` (0-based) fenced block of exactly `fence` backticks, tagged `markdown`, under `heading`. */
function fencedBlock(design, heading, fence, nth = 0) {
  const lines = design.split("\n");
  const start = lines.findIndex((l) => l.startsWith(heading));
  if (start < 0) throw new Error(`the design has no "${heading}"`);
  const opens = lines.map((l, i) => (i > start && l === `${fence}markdown` ? i : -1)).filter((i) => i >= 0);
  const open = opens[nth] ?? -1;
  const close = lines.findIndex((l, i) => i > open && l === fence);
  if (open < 0 || close < 0) throw new Error(`no ${fence}markdown block under "${heading}"`);
  return lines.slice(open + 1, close).join("\n");
}

/** The R59 checklists: from `### Adding a Covered repo` to the end of the paragraph under the drift check. */
function checklists(design) {
  const lines = design.split("\n");
  const start = lines.indexOf("### Adding a Covered repo");
  // Shim: the fixtures are frozen at 043deaa, where the heading was the old title. Drop the old title when the
  // fixtures are refrozen at a commit that has the new one.
  const last = [
    "### Checking a Covered repo's gate copy for drift",
    "### Checking a Covered repo's callers for drift",
  ].map((t) => lines.indexOf(t)).find((i) => i >= 0);
  if (start < 0 || last === undefined) throw new Error("the design has no R59 checklists");
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

/** The legend of a Home file (R59): the lines [from, to) holding the paragraph after the first non-heading one. */
function legendRange(lines) {
  let i = 0;
  const blank = (k) => k < lines.length && lines[k].text.trim() === "";
  const skipBlank = () => { while (blank(i)) i++; };
  const skipPara = () => { while (i < lines.length && !blank(i)) i++; };
  for (;;) {
    skipBlank();
    if (i >= lines.length) return null;
    const heading = lines[i].text.startsWith("#");
    skipPara();
    if (!heading) break;
  }
  const from = i;
  skipBlank();
  skipPara();
  return { from, to: i };
}

/** `lines` without the Home repo's legend. */
function withoutLegend(lines) {
  const r = legendRange(lines);
  return r === null ? lines : [...lines.slice(0, r.from), ...lines.slice(r.to)];
}

/** `text` (rendered, no legend) with the legend of the numbered `old` lines put back where it stood. */
function withLegend(old, text) {
  const had = legendRange(old);
  const lines = text.split("\n");
  const at = legendRange(lines.map((t, i) => ({ n: i + 1, text: t })));
  if (had === null || at === null) return text;
  lines.splice(at.from, 0, ...old.slice(had.from, had.to).map((l) => l.text));
  return lines.join("\n");
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

/** A caller template at the pin compared with the repo's workflow `name`. */
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

/**
 * The files of a Home repo (`home`) re-adopted at `pin`, rendered from `source` (goal-agent at `pin`): a map of
 * path to new text, or to null for a file to remove. The Home repo's own parts stay: the definition's text apart
 * from its `goal-agent-pin`, the legends, the sections that are not adopted, `enabledPlugins`. A Home repo
 * written with these files has no drift from `source`, except where its definition differs from the skeleton in
 * a way only the user can resolve; the caller checks that with compareHome. Throws when the Home repo has not
 * adopted the text yet: the first adoption is by hand (R59).
 */
export function adoptFiles({ source, home, name, pin }) {
  const defFile = `.claude/agents/${name}.md`;
  const definition = home.read(defFile);
  const agents = home.read("docs/agents/goal-agents.md");
  const tracker = home.read("docs/agents/issue-tracker.md");
  const ops = tracker === null ? null : section(tracker, "## Goal agent operations");
  if (definition === null || pinOf(definition) === null || agents === null || ops === null) {
    throw new Error("the Home repo has not adopted the text yet (definition with goal-agent-pin, docs/agents/goal-agents.md, the operations section): do the first adoption by hand, R59");
  }
  const r = renderSources(source, pin);
  const files = { [defFile]: definition.replace(/^goal-agent-pin:.*$/m, `goal-agent-pin: ${pin}`) };

  const lines = numbered(agents);
  const split = lines.findIndex((l) => l.text === "## Checklists");
  const contract = withLegend(split < 0 ? lines : lines.slice(0, split), r.contract).replace(/\n+$/, "");
  const after = split < 0 ? [] : lines.slice(split + 1).map((l) => l.text);
  const first = after.findIndex((t) => t.startsWith("### "));
  const end = after.findIndex((t) => t.startsWith("## "));
  const intro = after.slice(0, first < 0 ? after.length : first);
  const tail = end < 0 ? [] : after.slice(end);
  files["docs/agents/goal-agents.md"] = [contract, "", "## Checklists", ...(intro.length ? intro : [""]), r.checklists, ...(tail.length ? ["", ...tail] : [""])].join("\n");

  const trackerLines = numbered(tracker).map((l) => l.text);
  const blanks = ops.length - trimEnd(ops).length;
  trackerLines.splice(ops[0].n - 1, ops.length, ...withLegend(ops, r.operations).split("\n"), ...Array(blanks).fill(""));
  files["docs/agents/issue-tracker.md"] = trackerLines.join("\n");

  for (const dir of GUARD_DIRS) {
    const want = source.list(dir);
    for (const f of want) files[f] = source.read(f);
    for (const f of home.list(dir).filter((f) => !want.includes(f))) files[f] = null;
  }

  for (const dir of RETIRED_DIRS) for (const f of home.list(dir)) files[f] = null; // retired: removed, never rendered

  const template = source.read("templates/home-settings.json");
  const plugins = JSON.parse(home.read(".claude/settings.json") ?? "{}").enabledPlugins;
  files[".claude/settings.json"] = plugins === undefined ? template : `${JSON.stringify({ enabledPlugins: plugins, ...JSON.parse(template) }, null, 2)}\n`;

  const callers = HOME_CALLERS.filter((c) => source.read(`templates/${c}`) !== null);
  for (const c of callers) files[`.github/workflows/${c}`] = source.read(`templates/${c}`).replaceAll(PIN_PLACEHOLDER, pin);
  for (const f of home.list(".github/workflows/").filter((f) => !callers.some((c) => f.endsWith(`/${c}`)))) {
    const text = home.read(f).replace(/(uses:\s*hsmejky\/goal-agent\/\S*@)\S+/g, `$1${pin}`);
    if (text !== home.read(f)) files[f] = text;
  }
  return files;
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
 * The callers `{ template, workflow }` of a Covered repo (`covered`) against the templates of `source`. The pin
 * is the SHA in the gate caller's own `uses:` line; the agents are the repo's registry rows.
 */
function compareCallers({ source, covered }, callers) {
  const gate = covered.read(`.github/workflows/${COVERED_CALLERS[0]}`);
  if (gate === null) return missingFile("caller", `.github/workflows/${COVERED_CALLERS[0]}`);
  const pin = /uses:\s*hsmejky\/goal-agent\/\S*@(\S+)/.exec(gate)?.[1] ?? null;
  if (pin === null || !SHA.test(pin)) {
    return [{ item: "uses", file: `.github/workflows/${COVERED_CALLERS[0]}`, line: null, expected: "a full 40-hex goal-agent SHA", actual: pin }];
  }
  const names = registryNames(covered.read("docs/agents/goal-agents.md"));
  return callers.flatMap(({ template, workflow }) =>
    compareCaller(covered, workflow, renderCoveredCaller(source.read(`templates/${template}`), pin, names)));
}

/** A caller whose template and workflow share one file name. */
const sameName = (c) => ({ template: c, workflow: c });

/** A Covered repo's gate and Consultation callers (`covered`) against the templates of `source`: the gate's check. */
export function compareCovered({ source, covered }) {
  return compareCallers({ source, covered }, COVERED_CALLERS.map(sameName));
}

/**
 * A Covered repo's three callers (the gate's, Consultation's and the drift check's) against the templates of
 * `source`, all rendered at the gate caller's SHA: the Covered repo drift check. A caller at another SHA, a
 * missing caller and a short SHA are drift.
 */
export function compareCoveredDrift({ source, covered }) {
  return compareCallers({ source, covered }, [
    ...COVERED_CALLERS.map(sameName),
    { template: COVERED_DRIFT_TEMPLATE, workflow: COVERED_DRIFT_WORKFLOW },
  ]);
}

// ---------------------------------------------------------------- Covered repo rendering

const REGISTRY_FILE = "docs/agents/goal-agents.md";
const REGISTRY_HEADING = "## Goal agents in this repo";
const BLOCK_HEADING = "### Goal agents";
// Appendix E holds two fenced blocks: the CLAUDE.md block, then the agent docs file.
const BLOCK_SOURCE = 0;
const REGISTRY_SOURCE = 1;

/** The CLAUDE.md agent line of a Registry row; AGENT_LINE is derived from it, so they cannot drift apart. */
const agentLine = (a) => `- \`${a.name}\`: Home repo \`${a.home}\`, label \`${a.label}\`.`;
const AGENT_LINE = (() => {
  const field = (k) => `\u0000${k}\u0000`;
  const escaped = agentLine({ name: field("name"), home: field("home"), label: field("label") }).replace(/[.*+?^${}()|[\]\`]/g, "\$&");
  return new RegExp(`^${escaped.replace(/\u0000name\u0000/, "[^`]+").replace(/\u0000(home|label)\u0000/g, "[^`]*")}$`);
})();

const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
const trimNewlines = (text) => text.replace(/\n+$/, "");

/** Index of the first line at or after `i` that is not blank. */
function skipBlank(lines, i) {
  while (i < lines.length && lines[i].trim() === "") i++;
  return i;
}

/** `text` with `section` appended as a paragraph of its own. */
const appendSection = (text, section) => `${trimNewlines(text)}\n\n${section}\n`;

/** `lines` with the lines [from, to) replaced by `replacement`. */
const spliceLines = (lines, from, to, replacement) => [...lines.slice(0, from), ...replacement, ...lines.slice(to)];

/** Index of the first line after `from` that opens a heading of `level` or fewer `#`, else the end. */
function endOfSection(lines, from, level) {
  const heading = new RegExp(`^#{1,${level}} `);
  const i = lines.findIndex((l, k) => k > from && heading.test(l));
  return i < 0 ? lines.length : i;
}

/** `text` (a Covered repo's agent docs, or null) with the Registry section for `agents` and the rest kept. */
function renderRegistry(design, text, agents) {
  // Appendix E's file: a title, the section heading, the table header, one sample row, the paragraph.
  const canonical = fencedBlock(design, "## Appendix E", "```", REGISTRY_SOURCE).split("\n");
  const heading = canonical.indexOf(REGISTRY_HEADING);
  const table = canonical.findIndex((l) => l.startsWith("|"));
  const rows = agents.map((a) => `| \`${a.name}\` | \`${a.label}\` | \`${a.home}\` |`);
  const section = trimNewlines([...canonical.slice(heading, table + 2), ...rows, ...canonical.slice(table + 3)].join("\n"));
  if (text === null) return `${canonical.slice(0, heading).join("\n")}\n${section}\n`;
  const lines = text.split("\n");
  const start = lines.indexOf(REGISTRY_HEADING);
  if (start < 0) return appendSection(text, section);
  // The section is the heading, the table and the one paragraph directly under it (whatever its text, replaced by
  // Appendix E's paragraph); when the table is followed by a heading or the end, there is none. Text after is the user's.
  let end = skipBlank(lines, start + 1);
  while (end < lines.length && lines[end].startsWith("|")) end++;
  const paragraphStart = skipBlank(lines, end);
  if (paragraphStart < lines.length && !/^[#|]/.test(lines[paragraphStart])) {
    end = paragraphStart;
    while (end < lines.length && lines[end].trim() !== "") end++;
  }
  return spliceLines(lines, start, end, section.split("\n")).join("\n");
}

/** CLAUDE.md `text` (or null) with the agent lines of its `### Goal agents` block; the block is created when missing. */
function renderBlock(design, text, agents) {
  const canonical = fencedBlock(design, "## Appendix E", "```", BLOCK_SOURCE).split("\n");
  const sample = canonical.findIndex((l) => l.startsWith("- `<name>`"));
  const lines = agents.map(agentLine);
  const block = [...canonical.slice(0, sample), ...lines, ...canonical.slice(sample + 1)].join("\n");
  if (text === null) return `## Agent skills\n\n${block}\n`;
  const doc = text.split("\n");
  const start = doc.indexOf(BLOCK_HEADING);
  if (start >= 0) {
    const end = endOfSection(doc, start, 3);
    const firstAgentLine = doc.findIndex((l, k) => k > start && k < end && AGENT_LINE.test(l));
    const withoutAgentLines = doc.filter((l, k) => k <= start || k >= end || !AGENT_LINE.test(l));
    if (firstAgentLine >= 0) return spliceLines(withoutAgentLines, firstAgentLine, firstAgentLine, lines).join("\n");
    // A block without agent lines: they go after its first paragraph.
    let afterIntro = skipBlank(withoutAgentLines, start + 1);
    while (afterIntro < withoutAgentLines.length && withoutAgentLines[afterIntro].trim() !== "") afterIntro++;
    return spliceLines(withoutAgentLines, afterIntro, afterIntro, ["", ...lines]).join("\n");
  }
  const skills = doc.indexOf("## Agent skills");
  if (skills < 0) return appendSection(text, `## Agent skills\n\n${block}`);
  let end = endOfSection(doc, skills, 2);
  while (end > skills + 1 && doc[end - 1].trim() === "") end--;
  return spliceLines(doc, end, end, ["", ...block.split("\n")]).join("\n");
}

/**
 * The files of a Covered repo (`covered`) for the Registry rows `agents` ({ name, label, home }, any order) at
 * `pin`, rendered from `source` (goal-agent at `pin`): a map of path to new text, holding only the files that
 * differ from `covered`. The three callers carry one secret pair per agent in name order, the Registry table is
 * rendered in the same order, and the rest of the agent docs and of CLAUDE.md is kept byte for byte. In the agent
 * docs the Registry section belongs to the renderer: the heading, the table and the one paragraph directly under
 * the table (replaced by Appendix E's paragraph, whatever its text); anything after that paragraph is the user's.
 */
export function renderCovered({ source, covered, pin, agents }) {
  if (!SHA.test(pin)) throw new Error(`the pin must be a full 40-hex commit SHA, not ${JSON.stringify(pin)}`);
  const design = source.read(DESIGN);
  if (design === null) throw new Error(`the source has no ${DESIGN}`);
  const sorted = [...agents].sort(byName);
  const files = {
    [REGISTRY_FILE]: renderRegistry(design, covered.read(REGISTRY_FILE), sorted),
    "CLAUDE.md": renderBlock(design, covered.read("CLAUDE.md"), sorted),
  };
  const callers = [...COVERED_CALLERS.map(sameName), { template: COVERED_DRIFT_TEMPLATE, workflow: COVERED_DRIFT_WORKFLOW }];
  for (const { template, workflow } of callers) {
    files[`.github/workflows/${workflow}`] = renderCoveredCaller(source.read(`templates/${template}`), pin, sorted.map((a) => a.name));
  }
  return Object.fromEntries(Object.entries(files).filter(([path, text]) => covered.read(path) !== text));
}

/** Drift entries as text, one line each. */
export function formatDrift(drift) {
  return drift.map((d) => {
    const where = d.line === null ? d.file : `${d.file}:${d.line}`;
    const parts = [d.expected !== null ? `expected ${JSON.stringify(d.expected)}` : null, d.actual !== null ? `found ${JSON.stringify(d.actual)}` : null];
    return `${d.item}: ${where}: ${parts.filter(Boolean).join(", ")}`;
  }).join("\n");
}
