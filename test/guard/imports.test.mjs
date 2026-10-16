import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

// A Home repo's guard copy is scripts/guard/ plus scripts/lib/ (R45, ADR 0008), so the guard may not reach
// anywhere else in goal-agent.
const scripts = resolve(dirname(fileURLToPath(import.meta.url)), "../../scripts");
const allowed = ["guard", "lib"];

function* modules(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* modules(p);
    else if (e.name.endsWith(".mjs")) yield p;
  }
}

const specifiers = (src) =>
  [...src.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["']([^"']+)["']/g)].map((m) => m[1]);

test("scripts/lib/ holds the shared GitHub module and the gate no longer carries one", () => {
  assert.ok(existsSync(join(scripts, "lib", "github.mjs")));
  assert.ok(!existsSync(join(scripts, "gate", "github.mjs")));
});

test("the guard imports only node: built-ins, scripts/guard/ and scripts/lib/", () => {
  const seen = [];
  for (const file of modules(join(scripts, "guard"))) {
    for (const spec of specifiers(readFileSync(file, "utf8"))) {
      if (spec.startsWith("node:")) continue;
      assert.ok(spec.startsWith("."), `${file} imports the bare specifier ${spec}`);
      const target = relative(scripts, resolve(dirname(file), spec)).split(sep);
      assert.ok(allowed.includes(target[0]), `${file} imports ${spec}, outside scripts/guard/ and scripts/lib/`);
      seen.push(spec);
    }
  }
  assert.ok(seen.some((s) => s.includes("lib/github.mjs")), "the guard reaches the shared module through scripts/lib/");
});

test("scripts/lib/ imports nothing from outside itself", () => {
  for (const file of modules(join(scripts, "lib"))) {
    for (const spec of specifiers(readFileSync(file, "utf8"))) {
      if (spec.startsWith("node:")) continue;
      const target = relative(scripts, resolve(dirname(file), spec)).split(sep);
      assert.equal(target[0], "lib", `${file} imports ${spec}`);
    }
  }
});
