// adoptFiles (R59, the Home repo generator of #115): the files a Home repo holds after re-adoption at a pin.
// The property that matters is the one the drift check enforces: a Home repo with these files written has no
// drift from the source at the new pin.
import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { adoptFiles, compareHome, fsTree, overlay } from "../../scripts/render/render.mjs";

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

test("a Home repo that has not adopted the text yet is refused", () => {
  assert.throws(() => adoptFiles({ source: current, home: overlay(home, { "docs/agents/goal-agents.md": null }), name: NAME, pin: NEW_PIN }), /first adoption/);
});
