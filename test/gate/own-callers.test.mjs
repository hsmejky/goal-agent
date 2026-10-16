// goal-agent is a Covered repo: its own gate and Consultation workflows are the caller templates with
// <goal-agent-pin> set to one full 40-hex goal-agent commit (ADR 0008).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => readFileSync(join(repo, p), "utf8").replace(/\r\n/g, "\n");
const callers = ["goal-agent-review.yml", "goal-agent-consult.yml"];
const shaOf = (text) => /uses: hsmejky\/goal-agent\/\.github\/actions\/[a-z-]+@(\S+)/.exec(text)?.[1];

test("goal-agent's own callers name goal-agent at a full 40-hex SHA, the same in both", () => {
  const shas = callers.map((f) => shaOf(read(`.github/workflows/${f}`)));
  for (const sha of shas) assert.match(sha ?? "", /^[0-9a-f]{40}$/);
  assert.equal(shas[0], shas[1]);
});

test("goal-agent's own callers are the templates with the pin filled in", () => {
  for (const f of callers) {
    const own = read(`.github/workflows/${f}`);
    assert.equal(own, read(`templates/${f}`).replaceAll("<goal-agent-pin>", shaOf(own)));
  }
});
