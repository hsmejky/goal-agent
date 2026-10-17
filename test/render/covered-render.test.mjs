// The Covered repo rendering (#147): renderCovered returns the files of a Covered repo for its Registry rows at a
// pin: the three callers, the Registry section of docs/agents/goal-agents.md and the agent lines of the
// `### Goal agents` block in CLAUDE.md. Everything else in those two files stays byte for byte. Only files that
// change are returned. Source: this repo (design doc Appendix E, templates).
import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compareCoveredDrift, fsTree, overlay, registryNames, renderCovered } from "../../scripts/render/render.mjs";

const source = fsTree(join(dirname(fileURLToPath(import.meta.url)), "../.."));
const PIN = "b".repeat(40);
const DOCS = "docs/agents/goal-agents.md";
const WORKFLOWS = ["goal-agent-review.yml", "goal-agent-consult.yml", "goal-agent-drift-check.yml"].map((f) => `.github/workflows/${f}`);
const nothing = { read: () => null, list: () => [] };
const agent = (name) => ({ name, label: `goal-agent:${name}`, home: `me/${name}-home` });
const AGENTS = [agent("zeta"), agent("alpha")];

const render = (covered, agents = AGENTS, pin = PIN) => renderCovered({ source, covered, pin, agents });
/** `covered` after a repo is written with the rendered files. */
const apply = (covered, files) => overlay(covered, files);
const adopted = (agents = AGENTS) => apply(nothing, render(nothing, agents));
const secretNames = (text) => [...text.matchAll(/^\s*GOAL_AGENT_([A-Z0-9_]+?)_FIRE_TOKEN:/gm)].map((m) => m[1]);
const PARAGRAPH = render(nothing)[DOCS].replace(/^[\s\S]*\n\n(?=Each agent's)/, "").replace(/\n+$/, "");
const ALL = [...WORKFLOWS, "CLAUDE.md", DOCS].sort();

test("a Covered repo with no Goal agent files gets three callers, the agent docs and a CLAUDE.md block, and has no drift", () => {
  const files = render(nothing);
  assert.deepEqual(Object.keys(files).sort(), ALL);
  assert.deepEqual(compareCoveredDrift({ source, covered: apply(nothing, files) }), []);
  assert.match(files[DOCS], /^# Goal agents\n\n## Goal agents in this repo\n\n\| Goal agent \| Label \| Home repo \|\n\|---\|---\|---\|\n/);
  assert.match(files["CLAUDE.md"], /^## Agent skills\n\n### Goal agents\n\nGoal agents covering this repo: see `docs\/agents\/goal-agents.md`\.\n\n- `alpha`: Home repo `me\/alpha-home`, label `goal-agent:alpha`\.\n- `zeta`: Home repo `me\/zeta-home`, label `goal-agent:zeta`\.\n\nConsult a Goal agent through a comment on the issue, never by running it:\n/);
  assert.ok(files["CLAUDE.md"].includes("`> *Question for <name> Goal agent.*`"));
});

test("a Covered repo that already matches gets no changed file", () => {
  assert.deepEqual(render(adopted()), {});
});

test("this repo, a Covered repo of goal-steward, already matches its rendering", () => {
  const pin = /uses:\s*hsmejky\/goal-agent\/\S*@([0-9a-f]{40})/.exec(source.read(WORKFLOWS[0]))[1];
  const goalSteward = { name: "goal-steward", label: "goal-agent:goal-steward", home: "hsmejky/goal-steward-home" };
  // Only the drift-check caller, which this repo does not hold yet, is new.
  assert.deepEqual(Object.keys(render(source, [goalSteward], pin)), [WORKFLOWS[2]]);
});

test("Registry rows and the secret pairs of the gate and Consultation callers follow agent name order, whatever order the rows come in", () => {
  const four = ["mike", "zeta", "alpha", "b-2"].map(agent);
  const files = render(nothing, four);
  assert.deepEqual(render(nothing, [...four].reverse()), files);
  assert.deepEqual(registryNames(files[DOCS]), ["alpha", "b-2", "mike", "zeta"]);
  // The drift-check caller holds no secrets, so its template has no pair to repeat.
  for (const w of WORKFLOWS.slice(0, 2)) assert.deepEqual(secretNames(files[w]), ["ALPHA", "B_2", "MIKE", "ZETA"], w);
  assert.deepEqual(secretNames(files[WORKFLOWS[2]]), []);
  assert.deepEqual(compareCoveredDrift({ source, covered: apply(nothing, files) }), []);
});

test("an added agent changes the Registry, the block's agent lines and the callers with secrets, and a new pin only the callers", () => {
  const before = adopted([agent("alpha")]);
  assert.deepEqual(Object.keys(render(before, [agent("alpha"), agent("zeta")])).sort(), [...WORKFLOWS.slice(0, 2), "CLAUDE.md", DOCS].sort());
  assert.deepEqual(Object.keys(render(before, [agent("alpha")], "c".repeat(40))).sort(), [...WORKFLOWS].sort());
});

test("hand-written text around the Registry section survives byte for byte, trailing text included", () => {
  const before = "# Goal agents\n\n\twhatever  \n\n## Intro\n\nHand-written.  \n\n";
  const after = "\n\n## Notes\n\n- kept\n  \n\ttrailing   ";
  const old = `${before}## Goal agents in this repo\n\n| Goal agent | Label | Home repo |\n|---|---|---|\n| \`gone\` | \`goal-agent:gone\` | \`me/gone-home\` |\n\n${PARAGRAPH}${after}`;
  const out = render(overlay(nothing, { [DOCS]: old }))[DOCS];
  const canonical = render(nothing)[DOCS].replace(/^[\s\S]*?(?=## Goal agents in this repo)/, "").replace(/\n+$/, "");
  assert.equal(out, `${before}${canonical}${after}`);
  assert.deepEqual(registryNames(out), ["alpha", "zeta"]);
});

test("a paragraph of the user's right after the Registry table is kept byte for byte, after the canonical paragraph", () => {
  const mine = "My own note about\nthese agents.  ";
  const old = `# Goal agents\n\n## Goal agents in this repo\n\n| Goal agent | Label | Home repo |\n|---|---|---|\n| \`gone\` | \`goal-agent:gone\` | \`me/gone-home\` |\n\n${mine}\n\n## Other\n\ntext\n`;
  const files = render(overlay(nothing, { [DOCS]: old }));
  assert.ok(files[DOCS].endsWith(`${PARAGRAPH}\n\n${mine}\n\n## Other\n\ntext\n`));
  assert.deepEqual(registryNames(files[DOCS]), ["alpha", "zeta"]);
  assert.deepEqual(render(apply(nothing, files)), {});
});

test("a Registry section without the paragraph, or a docs file without the section, gets the section in place", () => {
  const bare = "# Goal agents\n\n## Goal agents in this repo\n\n| Goal agent | Label | Home repo |\n|---|---|---|\n| `x` | `goal-agent:x` | `me/x-home` |\n\n## Other\n\ntext\n";
  const out = render(overlay(nothing, { [DOCS]: bare }))[DOCS];
  assert.ok(out.endsWith("review from that agent; the `goal-agent-review` status waits for it.\n\n## Other\n\ntext\n"));
  assert.deepEqual(registryNames(out), ["alpha", "zeta"]);
  const none = render(overlay(nothing, { [DOCS]: "# Mine\n\nText.\n" }))[DOCS];
  assert.ok(none.startsWith("# Mine\n\nText.\n\n## Goal agents in this repo\n\n| Goal agent |"));
  assert.deepEqual(registryNames(none), ["alpha", "zeta"]);
});

test("a CLAUDE.md with a Goal agents block gets only its agent lines replaced", () => {
  const claude = "# Mine\n\n## Agent skills\n\n### Goal agents\n\nMy intro.\n\n- `old`: Home repo `me/old-home`, label `goal-agent:old`.\n- `older`: Home repo `me/older-home`, label `goal-agent:older`.\n\nMy own rules.\n\n### Next\n\nkept  \n";
  const out = render(overlay(nothing, { "CLAUDE.md": claude }))["CLAUDE.md"];
  const lines = "- `alpha`: Home repo `me/alpha-home`, label `goal-agent:alpha`.\n- `zeta`: Home repo `me/zeta-home`, label `goal-agent:zeta`.";
  assert.equal(out, `# Mine\n\n## Agent skills\n\n### Goal agents\n\nMy intro.\n\n${lines}\n\nMy own rules.\n\n### Next\n\nkept  \n`);
});

test("a CLAUDE.md without the block gets one created under its Agent skills section, or under a new one", () => {
  const block = render(nothing)["CLAUDE.md"].replace("## Agent skills\n\n", "").replace(/\n+$/, "");
  const withSection = "## Agent skills\n\n### Issue tracker\n\nkept\n\n## After\n\ntext\n";
  assert.equal(render(overlay(nothing, { "CLAUDE.md": withSection }))["CLAUDE.md"], `## Agent skills\n\n### Issue tracker\n\nkept\n\n${block}\n\n## After\n\ntext\n`);
  assert.equal(render(overlay(nothing, { "CLAUDE.md": "# Mine\n\ntext" }))["CLAUDE.md"], `# Mine\n\ntext\n\n## Agent skills\n\n${block}\n`);
});

test("a pin that is not a full SHA is refused", () => {
  assert.throws(() => render(nothing, AGENTS, "main"), /40-hex/);
});
