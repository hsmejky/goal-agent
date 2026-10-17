// adoptFiles (R59, the Home repo generator of #115): the files a Home repo holds after re-adoption at a pin.
// The property that matters is the one the drift check enforces: a Home repo with these files written has no
// drift from the source at the new pin.
import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { adoptFiles, compareHome, fsTree, overlay, RETIRED_DIRS } from "../../scripts/render/render.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const fixtures = join(root, "test/fixtures");
const old = fsTree(join(fixtures, "goal-agent-043deaa"));
const home = fsTree(join(fixtures, "goal-steward-home"));
const current = fsTree(root);
const NAME = "goal-steward";
const OLD_PIN = "043deaa1aecf61f6bed469cd68414da1b3cbbf74";
const NEW_PIN = "b".repeat(40);

test("re-adopting at the pin the Home repo already has changes nothing", () => {
  const files = adoptFiles({ source: old, home, name: NAME, pin: OLD_PIN });
  for (const [path, text] of Object.entries(files)) assert.equal(text, home.read(path), path);
});

test("re-adopting at a newer commit leaves a Home repo with no drift from it", () => {
  const files = adoptFiles({ source: current, home, name: NAME, pin: NEW_PIN });
  assert.deepEqual(compareHome({ source: current, home: overlay(home, files), name: NAME }), []);
});

test("the new pin is set in the definition and in every caller's uses line", () => {
  const files = adoptFiles({ source: current, home, name: NAME, pin: NEW_PIN });
  assert.match(files[`.claude/agents/${NAME}.md`], new RegExp(`^goal-agent-pin: ${NEW_PIN}$`, "m"));
  const callers = Object.keys(files).filter((p) => p.startsWith(".github/workflows/"));
  assert.ok(callers.length >= 3);
  for (const p of callers) assert.match(files[p], new RegExp(`uses: hsmejky/goal-agent/\\.github/actions/[a-z-]+@${NEW_PIN}`), p);
});

test("the Home repo's own parts survive: the definition's sections, the legends and enabledPlugins", () => {
  const withPlugins = overlay(home, { ".claude/settings.json": JSON.stringify({ ...JSON.parse(home.read(".claude/settings.json")), enabledPlugins: { "x@y": true } }) });
  const files = adoptFiles({ source: current, home: withPlugins, name: NAME, pin: NEW_PIN });
  const def = files[`.claude/agents/${NAME}.md`];
  assert.equal(def.slice(def.indexOf("## Goal")), home.read(`.claude/agents/${NAME}.md`).slice(home.read(`.claude/agents/${NAME}.md`).indexOf("## Goal")));
  assert.deepEqual(JSON.parse(files[".claude/settings.json"]).enabledPlugins, { "x@y": true });
  const legend = (t) => t.split("\n").find((l) => l.startsWith("`<name>` in this file"));
  assert.ok(legend(home.read("docs/agents/goal-agents.md")), "fixture has a legend line");
  assert.equal(legend(files["docs/agents/goal-agents.md"]), legend(home.read("docs/agents/goal-agents.md")));
});

test("guard files that the source no longer has are removed (null)", () => {
  const stray = overlay(home, { "scripts/guard/old-rule.mjs": "x" });
  const files = adoptFiles({ source: current, home: stray, name: NAME, pin: NEW_PIN });
  assert.equal(files["scripts/guard/old-rule.mjs"], null);
});

test("the retired directories a Home repo still holds are removed (null), every file of them", () => {
  const stale = overlay(home, { "scripts/gate/gate.mjs": "x", "scripts/gate/lib/a.mjs": "x", "scripts/home/sync.mjs": "x" });
  const files = adoptFiles({ source: current, home: stale, name: NAME, pin: NEW_PIN });
  for (const f of ["scripts/gate/gate.mjs", "scripts/gate/lib/a.mjs", "scripts/home/sync.mjs"]) assert.equal(files[f], null, f);
  assert.deepEqual(RETIRED_DIRS, ["scripts/gate/", "scripts/home/"]);
});

test("a Home repo without the retired directories gets no removal for them", () => {
  const files = adoptFiles({ source: current, home, name: NAME, pin: NEW_PIN });
  assert.deepEqual(Object.keys(files).filter((p) => RETIRED_DIRS.some((d) => p.startsWith(d))), []);
});

// A never-synced Home repo holds only its definition, without goal-agent-pin (ADR 0011 points 15 and 16).
const HOME_REPO = "hsmejky/goal-steward-home";
const GENERIC = ["CLAUDE.md", "README.md", "memory/README.md", "docs/agents/issue-tracker.md", "docs/agents/triage-labels.md", "docs/agents/domain.md"];
const definition = home.read(`.claude/agents/${NAME}.md`);
const bare = overlay(fsTree(join(fixtures, "empty-dir-that-does-not-exist")), {
  [`.claude/agents/${NAME}.md`]: definition.replace(/^goal-agent-pin:.*\n/m, ""),
});
const adopt = (tree = bare, extra = {}) => adoptFiles({ source: current, home: tree, name: NAME, pin: NEW_PIN, homeRepo: HOME_REPO, ...extra });

test("a never-synced Home repo is created: pin, contract, checklists, operations, guard, settings, callers and the generic files", () => {
  const files = adopt();
  assert.match(files[`.claude/agents/${NAME}.md`], new RegExp(`^name: ${NAME}\ngoal-agent-pin: ${NEW_PIN}\n`, "m"));
  const agents = files["docs/agents/goal-agents.md"];
  assert.match(agents, /^`<name>` in this file is your name, the `name` in your definition\n\(`goal-steward`\)\.$/m);
  assert.ok(agents.includes("## Checklists") && agents.includes("### Adding a Covered repo"));
  assert.match(files["docs/agents/issue-tracker.md"], /^## Goal agent operations$/m);
  assert.match(files["docs/agents/issue-tracker.md"], /`<home>` is this repo, `hsmejky\/goal-steward-home`;/);
  assert.ok(files[".claude/settings.json"] && files["scripts/guard/rules.mjs"]);
  assert.ok(Object.keys(files).some((p) => p.startsWith(".github/workflows/")));
  for (const f of GENERIC) assert.equal(typeof files[f], "string", f);
});

test("a never-synced Home repo adopted then compared has no drift", () => {
  const files = adopt();
  assert.deepEqual(compareHome({ source: current, home: overlay(bare, files), name: NAME }), []);
});

test("the generic templates substitute only the agent name, the Home repo and the owner", () => {
  const files = adopt();
  for (const f of GENERIC) assert.doesNotMatch(files[f], /\{\{/, f);
  assert.match(files["CLAUDE.md"], /hsmejky\/goal-steward-home/);
  assert.match(files["README.md"], /goal-steward/);
});

test("a generic file the Home repo already holds is left untouched, whatever it holds", () => {
  const held = Object.fromEntries(GENERIC.filter((f) => f !== "docs/agents/issue-tracker.md").map((f) => [f, `mine: ${f}
`]));
  const files = adopt(overlay(bare, held));
  for (const f of Object.keys(held)) assert.equal(Object.hasOwn(files, f), false, f);
});

test("re-adopting a synced Home repo rewrites none of the generic files", () => {
  const held = overlay(home, Object.fromEntries(GENERIC.filter((f) => f !== "docs/agents/issue-tracker.md").map((f) => [f, "mine\n"])));
  const files = adoptFiles({ source: current, home: held, name: NAME, pin: NEW_PIN, homeRepo: HOME_REPO });
  for (const f of GENERIC.filter((f) => f !== "docs/agents/issue-tracker.md")) assert.equal(Object.hasOwn(files, f), false, f);
});

test("a tracker doc without the operations section gets the section, with its legend, and keeps the rest", () => {
  const tracker = "# Issue tracker: mine\n\nOwn text.\n";
  const files = adopt(overlay(bare, { "docs/agents/issue-tracker.md": tracker }));
  assert.ok(files["docs/agents/issue-tracker.md"].startsWith(tracker));
  assert.match(files["docs/agents/issue-tracker.md"], /^## Goal agent operations$/m);
  assert.deepEqual(compareHome({ source: current, home: overlay(bare, files), name: NAME }), []);
});

test("a never-synced Home repo adopted without its repo name is refused", () => {
  assert.throws(() => adopt(bare, { homeRepo: undefined }), /homeRepo/);
});
