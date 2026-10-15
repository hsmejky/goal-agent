// Fake `gh`. Only `gh api <REST path>` is served; anything else fails the test (see README).
import { readFileSync, writeFileSync } from "node:fs";
import { handle, Unsupported } from "../fake-github.mjs";

const stateFile = process.env.FAKE_GH_STATE;
const state = JSON.parse(readFileSync(stateFile, "utf8"));
const save = () => writeFileSync(stateFile, JSON.stringify(state, null, 2));

function violation(message) {
  state.violations.push({ tool: "gh", argv: process.argv.slice(2), message });
  save();
  process.stderr.write(`fake gh: ${message}\n`);
  process.exit(1);
}

const argv = process.argv.slice(2);
if (argv[0] !== "api") {
  violation(`"gh ${argv.join(" ")}" is not allowed: scripts may only call "gh api <REST path>" (the cloud GitHub proxy rejects GraphQL-based gh subcommands)`);
}
const args = argv.slice(1);
let method, path, inputFile;
const fields = {};
const typed = (v) => (v === "true" ? true : v === "false" ? false : /^-?\d+$/.test(v) ? Number(v) : v);
function addField(spec, convert) {
  const i = spec.indexOf("=");
  const key = spec.slice(0, i);
  const value = convert ? typed(spec.slice(i + 1)) : spec.slice(i + 1);
  if (key.endsWith("[]")) (fields[key.slice(0, -2)] ??= []).push(value);
  else fields[key] = value;
}
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "-X" || a === "--method") method = args[++i].toUpperCase();
  else if (a === "-f" || a === "--raw-field") addField(args[++i], false);
  else if (a === "-F" || a === "--field") addField(args[++i], true);
  else if (a === "--input") inputFile = args[++i];
  else if (a === "-H" || a === "--header") i++;
  else if (a === "--paginate" || a === "--silent" || a === "-i" || a === "--include") continue;
  else if (a === "--jq" || a === "-q" || a === "--template" || a === "-t") violation(`${a} is not supported by the fake; parse the JSON output in the script instead`);
  else if (a.startsWith("-")) violation(`flag ${a} is not supported by the fake gh api`);
  else path = a;
}
if (!path) violation("gh api needs a path");
const [rawPath, qs = ""] = path.split("?");
if (/^\/?graphql$/.test(rawPath)) violation("gh api graphql is not allowed: the cloud GitHub proxy rejects GraphQL; use a REST path");
const query = Object.fromEntries(new URLSearchParams(qs));
method ??= Object.keys(fields).length || inputFile ? "POST" : "GET";
let body = {};
if (inputFile) body = JSON.parse(readFileSync(inputFile === "-" ? 0 : inputFile, "utf8"));
else if (method === "GET") Object.assign(query, fields);
else body = fields;

let res;
try {
  res = handle(state, { method, path: rawPath, query, body });
} catch (e) {
  if (e instanceof Unsupported) violation(`REST route not supported: ${e.message}`);
  throw e;
}
save();
if (res.status >= 400) {
  process.stderr.write(`gh: ${res.body.message} (HTTP ${res.status})\n`);
  process.stdout.write(JSON.stringify(res.body) + "\n");
  process.exit(1);
}
process.stdout.write(JSON.stringify(res.body) + "\n");
