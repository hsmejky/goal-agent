// The rendering module (R59): renders what re-adoption copies from goal-agent at one pin, and compares a Home
// repo or a Covered repo against it. Fixtures: goal-agent at 043deaa (design doc, templates, guard) and a
// snapshot of goal-steward-home pinned to it.
// Reproduce done-when 4 of #114 against the live repo (goal-steward-home origin/main 8da1a63):
//   git archive 043deaa | tar -x -C ga-043   (in a goal-agent clone, into an empty ga-043)
//   node scripts/home/drift-check.mjs --source ga-043 --home goal-steward-home   -> "drift check: no drift", exit 0
import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compareCovered, compareCoveredDrift, compareHome, COVERED_DRIFT_TEMPLATE, COVERED_DRIFT_WORKFLOW, DESIGN, fsTree, GUARD_DIRS, HOME_CALLERS, HOME_GENERIC, overlay, registryNames, renderCoveredCaller, renderSources, renderText } from "../../scripts/render/render.mjs";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "../fixtures");
const source = fsTree(join(fixtures, "goal-agent-043deaa"));
const home = fsTree(join(fixtures, "goal-steward-home"));
const NAME = "goal-steward";
const PIN = "043deaa1aecf61f6bed469cd68414da1b3cbbf74";

/** The Home fixture with one file's text changed by `edit`. */
const mutate = (path, edit) => overlay(home, { [path]: edit(home.read(path)) });
const items = (drift) => [...new Set(drift.map((d) => d.item))];

test("goal-steward-home as it stands has no drift from goal-agent at its pin", () => {
  assert.deepEqual(compareHome({ source, home, name: NAME }), []);
});

/** Replace the one occurrence of `from` in the text (fails the test if it is not there). */
const swap = (from, to) => (text) => {
  assert.ok(text.includes(from), `fixture holds ${JSON.stringify(from)}`);
  return text.replace(from, to);
};

const driftCases = [
  ["contract", "docs/agents/goal-agents.md", swap("Never write your definition;", "Never write your own definition;")],
  ["checklists", "docs/agents/goal-agents.md", swap("2. Disable the routine.", "2. Pause the routine.")],
  ["operations", "docs/agents/issue-tracker.md", swap("None: create it. More than one: stop and report.", "None: create it.")],
  ["skeleton", `.claude/agents/${NAME}.md`, swap("Goal agent contract. If you cannot read it, stop and report.", "Goal agent contract.")],
  ["guard", "scripts/guard/rules.mjs", swap("export const RULES", "export  const RULES")],
  ["settings", ".claude/settings.json", (t) => JSON.stringify({ ...JSON.parse(t), permissions: { allow: ["Bash"] } }, null, 2)],
  ["caller", ".github/workflows/goal-agent-audit.yml", swap("branches: [main]", "branches: [main, dev]")],
];

for (const [item, path, edit] of driftCases) {
  test(`a changed ${item} line is ${item} drift, reported at its file and line`, () => {
    const drift = compareHome({ source, home: mutate(path, edit), name: NAME });
    assert.deepEqual(items(drift), [item]);
    assert.ok(drift.every((d) => d.file === path));
    if (item !== "settings") assert.ok(drift.some((d) => Number.isInteger(d.line) && d.actual !== null), JSON.stringify(drift));
  });
}

test("a goal-agent `uses:` at any SHA other than the pin is uses drift", () => {
  const wf = (sha) => `jobs:\n  x:\n    steps:\n      - uses: hsmejky/goal-agent/.github/actions/home-audit@${sha}\n`;
  const at = (sha) => compareHome({ source, home: overlay(home, { ".github/workflows/extra.yml": wf(sha) }), name: NAME });
  assert.deepEqual(at(PIN), []);
  const drift = at("1".repeat(40));
  assert.deepEqual(drift.map((d) => [d.item, d.file, d.line]), [["uses", ".github/workflows/extra.yml", 4]]);
});

test("a caller template at the pin whose Home repo caller file is absent is caller drift", () => {
  for (const name of HOME_CALLERS.filter((n) => source.read(`templates/${n}`) !== null)) {
    const drift = compareHome({ source, home: overlay(home, { [`.github/workflows/${name}`]: null }), name: NAME });
    assert.deepEqual(items(drift), ["caller"], name);
    assert.equal(drift[0].file, `.github/workflows/${name}`);
  }
});

test("a guard file missing from or added to the Home repo is guard drift", () => {
  assert.deepEqual(items(compareHome({ source, home: overlay(home, { "scripts/guard/rules.mjs": null }), name: NAME })), ["guard"]);
  assert.deepEqual(items(compareHome({ source, home: overlay(home, { "scripts/lib/extra.mjs": "x" }), name: NAME })), ["guard"]);
});

test("the agent-specific parts of the definition and settings' enabledPlugins are not compared", () => {
  const def = `.claude/agents/${NAME}.md`;
  const changed = overlay(home, {
    [def]: home.read(def).replace("## Goal\n", "## Goal\n\nA different goal.\n").replace("cadence: PT1H", "cadence: PT2H"),
    ".claude/settings.json": JSON.stringify({ ...JSON.parse(home.read(".claude/settings.json")), enabledPlugins: {} }),
  });
  assert.deepEqual(compareHome({ source, home: changed, name: NAME }), []);
});

test("a definition without the pin, or at a pin whose rendered links differ, drifts", () => {
  const def = `.claude/agents/${NAME}.md`;
  const other = overlay(home, { [def]: home.read(def).replace(PIN, "2".repeat(40)) });
  // Every rendered link to goal-agent names the pin, so the copied text no longer matches.
  assert.ok(items(compareHome({ source, home: other, name: NAME })).includes("checklists"));
  const none = overlay(home, { [def]: home.read(def).replace(/^goal-agent-pin:.*\n/m, "") });
  assert.deepEqual(items(compareHome({ source, home: none, name: NAME })), ["skeleton"]);
});

test("a missing legend paragraph is contract drift: the legend is the Home repo's, the next paragraph is not", () => {
  const drift = compareHome({ source, home: mutate("docs/agents/goal-agents.md", swap("`<name>` in this file is your name, the `name` in your definition\n(`goal-steward`).\n\n", "")), name: NAME });
  assert.deepEqual(items(drift), ["contract"]);
});

test("a placeholder unit of the skeleton matches any text in place of each <...>, and only that", () => {
  const def = `.claude/agents/${NAME}.md`;
  const reworded = mutate(def, swap("You run unattended, in many short sessions;", "You run attended, in many short sessions;"));
  assert.deepEqual(items(compareHome({ source, home: reworded, name: NAME })), ["skeleton"]);
  const rewrapped = mutate(def, swap("You are the goal-steward Goal agent. You run unattended, in many short sessions;\ncontinuity",
    "You are the goal-steward Goal agent. You run unattended,\nin many short sessions; continuity"));
  assert.deepEqual(compareHome({ source, home: rewrapped, name: NAME }), []);
});

// ---------------------------------------------------------------- R59 holds the rules this module implements

const repo = join(dirname(fileURLToPath(import.meta.url)), "../..");
const design = fsTree(repo).read("docs/goal-agents-with-engineering-skills.md");
const r59 = design.slice(design.indexOf('<a id="r59"></a>'), design.indexOf("\n### Adding a Covered repo\n"));
/** The `- ` bullets of the R59 list that follows the bold lead `lead`. */
const bullets = (lead) => {
  const after = r59.slice(r59.indexOf(lead));
  return after.split("\n").slice(1).filter((l, i, all) => l.startsWith("- ") && all.slice(0, i).every((x) => x === "" || x.startsWith("- ")));
};
const at = (pin) => `https://github.com/hsmejky/goal-agent/blob/${pin}/docs/`;

const substitutionCases = [
  [/^- `\[Rn\]\(#rn\)` becomes `Rn`/, () => assert.equal(renderText("see [R57](#r57) and [R5](#r5)", PIN), "see R57 and R5")],
  [/^- Every other link to this document/, () => {
    const defs = new Map([["50", "adr/0006-x.md"], ["43", "https://github.com/hsmejky/goal-agent/issues/51"]]);
    assert.equal(renderText("[Appendix E](#appendix-e-covered-repo-files), [ADR 0006][50], [Q][43]", PIN, defs),
      `[Appendix E](${at(PIN)}goal-agents-with-engineering-skills.md#appendix-e-covered-repo-files), [ADR 0006](${at(PIN)}adr/0006-x.md), [Q](https://github.com/hsmejky/goal-agent/issues/51)`);
  }],
  [/^- In Appendix A, the `goal-agent-pin` placeholder becomes the pin value/, () => {
    const def = `.claude/agents/${NAME}.md`;
    const drift = compareHome({ source, home: mutate(def, swap(`goal-agent-pin: ${PIN}`, `goal-agent-pin: ${PIN} # pinned`)), name: NAME });
    // Appendix A's two-line placeholder is not compared; the field must be the pin value alone.
    assert.deepEqual(drift.map((d) => d.item), ["skeleton"]);
  }],
  [/^- The Home repo adds one legend paragraph/, () => {
    const legend = mutate("docs/agents/issue-tracker.md", swap("`<home>` is this repo, `hsmejky/goal-steward-home`;", "`<home>` is this Home repo, `hsmejky/goal-steward-home`;"));
    assert.deepEqual(compareHome({ source, home: legend, name: NAME }), []);
  }],
  [/^- The `## Checklists` introduction/, () => {
    const intro = mutate("docs/agents/goal-agents.md", swap("of the definition; `R<n>` names a requirement there.", "of the definition."));
    assert.deepEqual(compareHome({ source, home: intro, name: NAME }), []);
  }],
  [/^- In the caller templates, `<goal-agent-pin>` becomes the pin/, () => {
    const drift = fsTree(repo).read("templates/goal-agent-drift-check.yml");
    const src = overlay(source, { "templates/goal-agent-drift-check.yml": drift });
    const wf = drift.replaceAll("<goal-agent-pin>", PIN);
    assert.deepEqual(compareHome({ source: src, home: overlay(home, { ".github/workflows/goal-agent-drift-check.yml": wf }), name: NAME }), []);
    assert.deepEqual(items(compareHome({ source: src, home, name: NAME })), ["caller"]);
  }],
];

test("R59's Substitutions are exactly the cases this module implements, in order", () => {
  const list = bullets("**Substitutions.**");
  assert.equal(list.length, substitutionCases.length, list.join("\n"));
  list.forEach((b, i) => assert.match(b, substitutionCases[i][0]));
});

for (const [lead, check] of substitutionCases) test(`substitution: ${lead.source.slice(3, 60)}`, check);

test("R59's Comparison rules name every compared item, in order", () => {
  const leads = bullets("**Comparison rules.**").map((b) => /^- (.+?): /.exec(b)?.[1]);
  assert.deepEqual(leads, ["Contract, checklists and operations", "Skeleton", "Guard", "Settings", "Callers", "`uses:`"]);
});

test("R59's table lists the sources this module renders, and their targets", () => {
  const rows = [...r59.matchAll(/^\| (.+) \| (.+) \|$/gm)].map((m) => [m[1], m[2]]).slice(2);
  assert.deepEqual(rows.slice(4), [
    ["`scripts/guard/`, `scripts/lib/`", "`scripts/guard/`, `scripts/lib/`"],
    ["`templates/home-settings.json`", "`.claude/settings.json`"],
    ["`templates/goal-agent-audit.yml`, `templates/goal-agent-staleness.yml`, `templates/goal-agent-drift-check.yml`, `templates/goal-agent-sync.yml`", "`.github/workflows/`"],
    ["The generic templates `templates/home-CLAUDE.md`, `home-README.md`, `home-memory-README.md`, `home-issue-tracker.md`, `home-triage-labels.md` and `home-domain.md`", "`CLAUDE.md`, `README.md`, `memory/README.md`, `docs/agents/issue-tracker.md`, `triage-labels.md` and `domain.md`: created only when missing and never rewritten; their only substitutions are the agent name, the Home repo and the owner, and the drift check ignores them apart from the sections it owns"],
  ]);
  assert.deepEqual(HOME_GENERIC.map(([t]) => t), ["home-CLAUDE.md", "home-README.md", "home-memory-README.md", "home-issue-tracker.md", "home-triage-labels.md", "home-domain.md"]);
  assert.deepEqual(GUARD_DIRS, ["scripts/guard/", "scripts/lib/"]);
  assert.deepEqual(HOME_CALLERS, ["goal-agent-audit.yml", "goal-agent-staleness.yml", "goal-agent-drift-check.yml", "goal-agent-sync.yml"]);
});

// ---------------------------------------------------------------- Covered repos

const goalAgent = fsTree(repo);

test("goal-agent, a Covered repo, has callers equal to its templates at its gate pin for its registry", () => {
  assert.deepEqual(registryNames(goalAgent.read("docs/agents/goal-agents.md")), ["goal-steward"]);
  assert.deepEqual(compareCovered({ source: goalAgent, covered: goalAgent }), []);
});

test("a Covered caller has one secret pair per registry agent, in registry order", () => {
  const out = renderCoveredCaller("a\n  env:\n    GOAL_AGENT_GOAL_STEWARD_FIRE_TOKEN: x\n    GOAL_AGENT_GOAL_STEWARD_TRIGGER_ID: y\n@<goal-agent-pin>\n", "abc", ["goal-steward", "b-2"]);
  assert.equal(out, "a\n  env:\n    GOAL_AGENT_GOAL_STEWARD_FIRE_TOKEN: x\n    GOAL_AGENT_GOAL_STEWARD_TRIGGER_ID: y\n    GOAL_AGENT_B_2_FIRE_TOKEN: x\n    GOAL_AGENT_B_2_TRIGGER_ID: y\n@abc\n");
});

test("a Covered caller that misses a registry agent's pair, or differs in a line, is caller drift", () => {
  const reg = goalAgent.read("docs/agents/goal-agents.md");
  const two = overlay(goalAgent, { "docs/agents/goal-agents.md": `${reg}| \`other\` | \`goal-agent:other\` | \`me/other-home\` |\n` });
  const drift = compareCovered({ source: goalAgent, covered: two });
  assert.deepEqual(items(drift), ["caller"]);
  assert.equal(drift.length, 4); // two missing lines in each of the two callers
  const consult = ".github/workflows/goal-agent-consult.yml";
  const edited = overlay(goalAgent, { [consult]: goalAgent.read(consult).replace("runs-on: ubuntu-latest", "runs-on: self-hosted") });
  assert.deepEqual(compareCovered({ source: goalAgent, covered: edited }).map((d) => [d.item, d.file]), [["caller", consult], ["caller", consult]]);
});

test("a Covered gate caller whose pin is not a full 40-hex SHA is uses drift", () => {
  const review = ".github/workflows/goal-agent-review.yml";
  const short = overlay(goalAgent, { [review]: goalAgent.read(review).replace(/@[0-9a-f]{40}/, "@main") });
  assert.deepEqual(items(compareCovered({ source: goalAgent, covered: short })), ["uses"]);
});

test("the checklists are found under the retitled drift heading as well as the old one", () => {
  const old = "### Checking a Covered repo's gate copy for drift";
  const text = source.read(DESIGN).split("\n").map((l) => (l === old ? "### Checking a Covered repo's callers for drift" : l)).join("\n");
  const retitled = overlay(source, { [DESIGN]: text });
  assert.ok(!text.split("\n").includes(old));
  const expected = renderSources(source, PIN).checklists.replace(old, "### Checking a Covered repo's callers for drift");
  assert.equal(renderSources(retitled, PIN).checklists, expected);
});

// ---------------------------------------------------------------- Covered repo drift check (ADR 0011 point 4)

const SHA_B = "b".repeat(40);
const wf = (name) => `.github/workflows/${name}`;
/** A Covered repo whose three callers are the templates rendered at `pin` for `names`; `files` overrides any file. */
function coveredAt(pin, names = ["goal-steward"], files = {}) {
  const registry = names.map((n) => `| \`${n}\` | \`goal-agent:${n}\` | \`me/${n}-home\` |`).join("\n");
  return overlay(goalAgent, {
    "docs/agents/goal-agents.md": `| Goal agent | Label | Home repo |\n|---|---|---|\n${registry}\n`,
    [wf("goal-agent-review.yml")]: renderCoveredCaller(goalAgent.read("templates/goal-agent-review.yml"), pin, names),
    [wf("goal-agent-consult.yml")]: renderCoveredCaller(goalAgent.read("templates/goal-agent-consult.yml"), pin, names),
    [wf(COVERED_DRIFT_WORKFLOW)]: renderCoveredCaller(goalAgent.read(`templates/${COVERED_DRIFT_TEMPLATE}`), pin, names),
    ...files,
  });
}
const drift = (covered) => compareCoveredDrift({ source: goalAgent, covered });

test("the Covered drift-check template has a name distinct from the Home repo one and renders to the same workflow name", () => {
  assert.notEqual(COVERED_DRIFT_TEMPLATE, "goal-agent-drift-check.yml");
  assert.equal(COVERED_DRIFT_WORKFLOW, "goal-agent-drift-check.yml");
});

test("a Covered repo with its three callers rendered at the gate's SHA for its registry has no drift", () => {
  assert.deepEqual(drift(coveredAt(SHA_B, ["goal-steward", "other"])), []);
});

test("a third caller at another SHA than the gate's is a differing line", () => {
  const third = wf(COVERED_DRIFT_WORKFLOW);
  const other = coveredAt(SHA_B).read(third).replace(SHA_B, "c".repeat(40));
  const out = drift(coveredAt(SHA_B, ["goal-steward"], { [third]: other }));
  assert.deepEqual(out.map((d) => [d.item, d.file]), [["caller", third], ["caller", third]]);
});

test("a missing third caller, and a short SHA in it, are drift", () => {
  const third = wf(COVERED_DRIFT_WORKFLOW);
  assert.deepEqual(drift(coveredAt(SHA_B, ["goal-steward"], { [third]: null })).map((d) => [d.item, d.file]), [["caller", third]]);
  const short = coveredAt(SHA_B).read(third).replace(SHA_B, SHA_B.slice(0, 12));
  assert.deepEqual(items(drift(coveredAt(SHA_B, ["goal-steward"], { [third]: short }))), ["caller"]);
});

test("the gate's caller check does not widen: compareCovered ignores the third caller", () => {
  const third = wf(COVERED_DRIFT_WORKFLOW);
  assert.deepEqual(compareCovered({ source: goalAgent, covered: coveredAt(SHA_B, ["goal-steward"], { [third]: null }) }), []);
  assert.deepEqual(compareCovered({ source: goalAgent, covered: coveredAt(SHA_B) }), []);
});
