import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hookSettings } from "../../scripts/guard/hook-command.mjs";

const template = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "templates", "home-settings.json");

test("the Home repo settings template registers the guard exactly as hookSettings() builds it", () => {
  assert.deepEqual(JSON.parse(readFileSync(template, "utf8")), hookSettings());
});

test("the template registers the guard for SessionStart and PreToolUse", () => {
  const { hooks } = JSON.parse(readFileSync(template, "utf8"));
  assert.deepEqual(Object.keys(hooks).sort(), ["PreToolUse", "SessionStart"]);
  assert.match(hooks.SessionStart[0].hooks[0].command, /guard\.mjs\W+session-start/);
  assert.match(hooks.PreToolUse[0].hooks[0].command, /guard\.mjs\W+pre-tool-use/);
});
