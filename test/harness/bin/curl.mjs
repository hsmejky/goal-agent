// Fake `curl`. Records each fire in the shared state and answers 200, or the configured rejection.
import { readFileSync, writeFileSync } from "node:fs";

const stateFile = process.env.FAKE_GH_STATE;
const state = JSON.parse(readFileSync(stateFile, "utf8"));
const args = process.argv.slice(2);
let method, url, fail = false, writeOut, outFile;
const headers = {};
const data = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "-X" || a === "--request") method = args[++i].toUpperCase();
  else if (a === "-H" || a === "--header") {
    const h = args[++i];
    const k = h.indexOf(":");
    headers[h.slice(0, k).trim().toLowerCase()] = h.slice(k + 1).trim();
  } else if (["-d", "--data", "--data-raw", "--data-binary"].includes(a)) {
    const v = args[++i];
    data.push(v === "@-" ? readFileSync(0, "utf8") : v.startsWith("@") && a !== "--data-raw" ? readFileSync(v.slice(1), "utf8") : v);
  } else if (a === "-f" || a === "--fail" || a === "--fail-with-body") fail = true;
  else if (a === "-w" || a === "--write-out") writeOut = args[++i];
  else if (a === "-o" || a === "--output") outFile = args[++i];
  else if (["-m", "--max-time", "--connect-timeout", "--retry", "-A", "-u"].includes(a)) i++;
  else if (a.startsWith("-")) continue; // -s -S -L -k and combined short flags
  else url = a;
}
const body = data.length ? data.join("&") : undefined;
method ??= body !== undefined ? "POST" : "GET";
const reject = state.curl?.reject;
const status = reject ? (reject.status ?? 500) : 200;
const respBody = reject ? (reject.body ?? "") : (state.curl?.body ?? "");
state.fires.push({ method, url, headers, body, responded: status });
writeFileSync(process.env.FAKE_GH_STATE, JSON.stringify(state, null, 2));
if (reject?.exit) process.exit(reject.exit); // e.g. 7 = connection refused
const toNull = outFile && /^(\/dev\/null|nul)$/i.test(outFile);
if (!(fail && status >= 400)) {
  if (!outFile) process.stdout.write(respBody);
  else if (!toNull) writeFileSync(outFile, respBody);
}
if (writeOut) process.stdout.write(writeOut.replaceAll("%{http_code}", String(status)));
process.exit(fail && status >= 400 ? 22 : 0);
