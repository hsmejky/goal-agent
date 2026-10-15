# Script test harness

Drives a goal-agent script at its process boundary (ADR 0006). `gh` and `curl` are faked on the
`PATH`; the fake `gh` is a stateful fake GitHub that serves **REST only**. No network, no dependencies.

Run everything: `npm test` (= `node --test "test/**/*.test.mjs"`).

## Usage

```js
import { createHarness } from "../harness/index.mjs";

const h = createHarness({
  repos: {
    "me/home": {
      issues: [{ number: 7, title: "Goal", labels: ["goal"], body: "..." }],   // optional: state, comments: [{body}]
      pulls: [{ number: 3, head_sha: "abc", state: "open", merged: false }],
      commits: [{ sha: "abc", pulls: [3] }],                                    // commit -> associated PRs
      statuses: { abc: [{ state: "success", context: "goal-review" }] },        // newest first
    },
  },
  curl: { reject: { status: 403, body: "nope" } },   // optional; omit for 200. `exit: 7` simulates a network error
});

const r = h.run(process.execPath, ["scripts/gate.mjs", "--pr", "3"], { env: { FOO: "1" }, input: "stdin" });
// r = { code, stdout, stderr }. `run` throws if the script made a call the fake refuses.

h.writes.statuses;    // [{ repo, sha, state, context, description, target_url }]
h.writes.comments;    // [{ repo, issue, body }]
h.writes.issueEdits;  // [{ repo, issue, changes }]
h.writes.newIssues;   // [{ repo, number, title, body, labels }]
h.writes.labels;      // [{ repo, issue, action: "add"|"remove", labels }]
h.writes.all;         // everything in order, with a `kind` field
h.fires;              // curl calls: [{ method, url, headers (lower-case keys), body, responded }]
h.state;              // current fake GitHub state, e.g. h.state.repos["me/home"].issues[7].state
h.cleanup();          // remove the temp dir (call in `after`)
```

`h.writeScript(name, content)` writes a helper file into the harness temp dir (useful for tiny probe scripts).

## What fails a test

`gh` anything other than `gh api <path>` (`gh issue list`, `gh pr view`...), `gh api graphql`,
`--jq`/`--template`, and REST routes the fake does not implement are recorded as violations and make
`h.run` throw with a `fake gh: ...` message (pass `{ allowViolations: true }` to inspect instead).
Missing resources (unknown issue number) return a normal 404 and are not violations.

Supported REST routes (all under `repos/{owner}/{repo}/`): `issues` (GET list with `state`, `labels`; POST),
`issues/{n}` (GET, PATCH), `issues/{n}/comments` (GET, POST), `issues/{n}/labels` (POST), `issues/{n}/labels/{name}` (DELETE),
`pulls` (GET), `pulls/{n}` (GET), `commits/{sha}` (files seeded as `files: [path]`), `commits/{sha}/pulls`, `commits/{sha}/statuses`, `commits/{sha}/status` (GET),
`statuses/{sha}` (POST). Add routes to `ROUTES` in `fake-github.mjs` (and a test) when a script needs more.
Supported `gh api` flags: `-X`, `-f`, `-F` (with `key[]=` arrays), `--input` (file or `-`), `-H`, `--paginate`.

## Platform notes

- The shims are `gh`/`curl` (POSIX sh) and `gh.cmd`/`curl.cmd` (Windows). On Windows only a shell
  resolves `.cmd` files, so a script must call `gh`/`curl` through a shell (bash, or Node with
  `shell: true`). A Node script using `spawn("curl")` without a shell would reach the real `curl.exe`
  on Windows: do not write scripts that way.
- Fake `curl` supports `-X`, `-H`, `-d/--data*` (including `@-` and `@file`), `-f/--fail`, `-w %{http_code}`, `-o`.
  With a configured rejection it exits 22 under `--fail`, otherwise prints the body and exits 0.
