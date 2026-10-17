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

const r = h.run(process.execPath, ["scripts/gate/gate.mjs", "--pr", "3"], { env: { FOO: "1" }, input: "stdin" });
// r = { code, stdout, stderr }. `run` throws if the script made a call the fake refuses.

h.writes.statuses;    // [{ repo, sha, state, context, description, target_url }]
h.writes.comments;    // [{ repo, issue, body }]
h.writes.issueEdits;  // [{ repo, issue, changes }]
h.writes.newIssues;   // [{ repo, number, title, body, labels }]
h.writes.newPulls;    // [{ repo, number, title, head, base, body }]
h.writes.labels;      // [{ repo, issue, action: "add"|"remove", labels }]
h.writes.closedPulls; // [{ repo, number }]
h.writes.all;         // everything in order, with a `kind` field
h.fires;              // curl calls: [{ method, url, headers (lower-case keys), body, responded }]
h.ghCalls;            // every gh invocation's argv, in order
h.state;              // current fake GitHub state, e.g. h.state.repos["me/home"].issues[7].state
h.cleanup();          // remove the temp dir (call in `after`)
```

`h.writeScript(name, content)` writes a helper file into the harness temp dir (useful for tiny probe scripts).

## What fails a test

`gh` anything other than `gh api <path>` and `gh auth token` (`gh issue list`, `gh pr view`...), `gh api graphql`,
`--jq`/`--template`, and REST routes the fake does not implement are recorded as violations and make
`h.run` throw with a `fake gh: ...` message (pass `{ allowViolations: true }` to inspect instead).
Missing resources (unknown issue number) return a normal 404 and are not violations.

Supported REST routes (all under `repos/{owner}/{repo}/`): `issues` (GET list with `state`, `labels`; POST),
`issues/{n}` (GET, PATCH), `issues/{n}/comments` (GET, POST), `issues/{n}/labels` (POST), `issues/{n}/labels/{name}` (DELETE),
`pulls` (GET with `state` and `head` = `owner:branch`, as the real API wants it: a bare branch or another owner matches nothing; a seeded PR's head owner is the repo owner unless `head_owner` is given; POST), `pulls/{n}` (GET; PATCH applies only `state`, `title`, `body`, and `state=closed` on an open PR is recorded once as `h.writes.closedPulls`), `contents/{path}` (GET, base64; seeded as `files: { path: text }`, or per ref as `refFiles: { ref: { path: text } }` and read with `?ref=`; a `?ref=` that is not seeded is always 404, as is a missing path; a request without `ref` reads `files`), `actions/secrets` (GET, names only; seeded as `secrets: [name]`, a `{ name, value }` entry keeps the name and drops the value; `{ total_count: 0, secrets: [] }` when unseeded), `labels` (GET; seeded as `labels: [name]`, `[]` when unseeded), `actions/policies` (GET, the repo Actions policies of Settings -> Actions -> Policies; seeded as `actionsPolicies: [policy]` in the shape of GitHub's "Actions Policy" object, see https://docs.github.com/en/rest/actions/policies, listed as `{ total_count, policies }`, an empty list when unseeded), `compare/{base}...{head}` (GET; seeded as `compare: { "main...sha": "behind" }`, else 404), `commits/{sha}` (files seeded as `files: [path]`), `commits/{sha}/pulls`, `commits/{sha}/statuses`, `commits/{sha}/status` (GET),
`statuses/{sha}` (POST). Add routes to `ROUTES` in `fake-github.mjs` (and a test) when a script needs more.
The user's token is seeded at the top level as `token: { value: "...", scopes: ["repo", "workflow"] }`; omit it for "no token".
Three token kinds are modelled, and this is the assumed contract the Pin move (#149) reads scopes by: a classic token with scopes sends `X-Oauth-Scopes: repo, workflow`; a classic token with `scopes: []` sends the header empty (`X-Oauth-Scopes: `); a fine-grained token (seed `token: { value }` with no `scopes`) sends no `X-Oauth-Scopes` header at all, so a script must treat a missing header as "scopes unknown", not as "no scopes".
`gh auth token` (the only `gh` subcommand besides `api`) prints the value, or exits 1 with `no oauth token found` when none is seeded.
`gh api -i user` (also `--include`) prints the response headers as above (exit 1 when no token), so a script can read the scopes.
Supported `gh api` flags: `-X`, `-f`, `-F` (with `key[]=` arrays), `--input` (file or `-`), `-H`, `--paginate`.

## Platform notes

- The shims are `gh`/`curl` (POSIX sh) and `gh.cmd`/`curl.cmd` (Windows). On Windows only a shell
  resolves `.cmd` files, so a script must call `gh`/`curl` through a shell (bash, or Node with
  `shell: true`). A Node script using `spawn("curl")` without a shell would reach the real `curl.exe`
  on Windows: do not write scripts that way.
- Fake `curl` supports `-X`, `-H`, `-d/--data*` (including `@-` and `@file`), `-f/--fail`, `-w %{http_code}`, `-o`.
  With a configured rejection it exits 22 under `--fail`, otherwise prints the body and exits 0.
