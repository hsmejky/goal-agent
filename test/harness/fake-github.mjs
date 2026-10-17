// Stateful fake GitHub REST API. Pure: handle(state, request) mutates `state` and returns
// { status, body }. Throws Unsupported for routes it does not implement; add routes to ROUTES.
//
// State shape (JSON-serialisable, persisted between fake `gh` processes):
//   { repos: { "owner/name": { issues: {n: issue}, comments: {n: [c]}, pulls: {n: pr},
//                              commits: {sha: {pulls: [n]}}, statuses: {sha: [status]},
//                              files: {path: text} (served by GET contents/<path>),
//                              refFiles: {ref: {path: text}} (served by GET contents/<path>?ref=<ref>),
//                              secrets: [name] (names only), labels: [name],
//                              actionsPolicies: [policy] (GET actions/policies, shape of GitHub's "Actions Policy") } },
//     token: {value, scopes?: [..]} | null (no `scopes` = a fine-grained token: no X-Oauth-Scopes header), nextId, writes: [...], violations: [...], ghCalls: [argv], fires: [...], curl: {reject?} }

export class Unsupported extends Error {}

const nameOf = (x) => (typeof x === "string" ? x : x.name);

export function newState(seed = {}) {
  const state = { repos: {}, token: seed.token ?? null, nextId: 1000, writes: [], violations: [], ghCalls: [], fires: [], curl: seed.curl ?? {} };
  const repos = { ...(seed.repos ?? {}) };
  if (seed.repo) repos[seed.repo] = seed;
  for (const [name, r] of Object.entries(repos)) {
    const repo = { issues: {}, comments: {}, pulls: {}, commits: {}, statuses: {}, compare: { ...(r.compare ?? {}) }, files: { ...(r.files ?? {}) }, refFiles: { ...(r.refFiles ?? {}) },
      secrets: (r.secrets ?? []).map(nameOf), // values are dropped on seeding: the fake never holds one
      labels: (r.labels ?? []).map(nameOf), actionsPolicies: (r.actionsPolicies ?? []).map((p) => ({ id: state.nextId++, ...p })) };
    for (const i of r.issues ?? []) {
      repo.issues[i.number] = { state: "open", body: "", user: { login: "someone" }, ...i, labels: [...(i.labels ?? [])] };
      repo.comments[i.number] = (i.comments ?? []).map((c) => ({ id: state.nextId++, user: { login: "someone" }, ...c }));
      delete repo.issues[i.number].comments;
    }
    for (const p of r.pulls ?? []) {
      repo.pulls[p.number] = { state: "open", merged: false, title: "", body: "", ...p, head: headOf(name, p) };
      delete repo.pulls[p.number].head_sha;
      delete repo.pulls[p.number].head_ref;
      delete repo.pulls[p.number].head_owner;
    }
    for (const c of r.commits ?? []) repo.commits[c.sha] = { pulls: c.pulls ?? [], files: c.files ?? [] };
    for (const [sha, list] of Object.entries(r.statuses ?? {})) repo.statuses[sha] = list.map((s) => ({ id: state.nextId++, ...s }));
    state.repos[name] = repo;
  }
  return state;
}

// head as the real API shows it: label is "owner:branch"; a PR from the repo itself has the repo owner
function headOf(repoName, p) {
  const ref = p.head_ref ?? p.head?.ref ?? "branch";
  const owner = p.head_owner ?? p.head?.user?.login ?? repoName.split("/")[0];
  return { sha: p.head_sha ?? p.head?.sha, ref, label: `${owner}:${ref}`, user: { login: owner } };
}

const notFound = (what) => ({ status: 404, body: { message: "Not Found", documentation_url: "https://docs.github.com/rest", detail: what } });
const ok = (body, status = 200) => ({ status, body });

const asIssue = (i) => ({ ...i, labels: i.labels.map((name) => ({ name })) });
const asPull = (p) => ({ ...p, labels: (p.labels ?? []).map((l) => ({ name: nameOf(l) })) });

function combined(list) {
  const latest = new Map();
  for (const s of [...list].reverse()) latest.set(s.context, s); // list is newest first
  const states = [...latest.values()].map((s) => s.state);
  const state = states.some((s) => s === "failure" || s === "error") ? "failure" : states.length === 0 || states.includes("pending") ? "pending" : "success";
  return { state, statuses: [...latest.values()], total_count: latest.size };
}

function record(state, kind, repo, entry) {
  state.writes.push({ kind, repo, ...entry });
}

const ROUTES = [
  // issues
  ["GET", /^issues$/, (s, repo, _m, { query }) => {
    const want = query.state ?? "open";
    const labels = query.labels ? String(query.labels).split(",") : [];
    return ok(Object.values(repo.issues).filter((i) => (want === "all" || i.state === want) && labels.every((l) => i.labels.includes(l))).map(asIssue));
  }],
  ["POST", /^issues$/, (s, repo, _m, { body, name }) => {
    const number = Math.max(0, ...Object.keys(repo.issues).map(Number), ...Object.keys(repo.pulls).map(Number)) + 1;
    const issue = { number, state: "open", title: body.title, body: body.body ?? "", labels: body.labels ?? [], user: { login: "goal-agent" } };
    repo.issues[number] = issue;
    repo.comments[number] = [];
    record(s, "issue-create", name, { number, title: body.title, body: body.body ?? "", labels: issue.labels });
    return ok(asIssue(issue), 201);
  }],
  ["GET", /^issues\/(\d+)$/, (s, repo, m) => (repo.issues[m[1]] ? ok(asIssue(repo.issues[m[1]])) : notFound("issue"))],
  ["PATCH", /^issues\/(\d+)$/, (s, repo, m, { body, name }) => {
    const issue = repo.issues[m[1]];
    if (!issue) return notFound("issue");
    Object.assign(issue, body);
    record(s, "issue-edit", name, { issue: Number(m[1]), changes: body });
    return ok(asIssue(issue));
  }],
  ["GET", /^issues\/(\d+)\/comments$/, (s, repo, m) => (repo.issues[m[1]] ? ok(repo.comments[m[1]] ?? []) : notFound("issue"))],
  ["POST", /^issues\/(\d+)\/comments$/, (s, repo, m, { body, name }) => {
    if (!repo.issues[m[1]] && !repo.pulls[m[1]]) return notFound("issue");
    const c = { id: s.nextId++, body: body.body, user: { login: "goal-agent" } };
    (repo.comments[m[1]] ??= []).push(c);
    record(s, "comment", name, { issue: Number(m[1]), body: body.body });
    return ok(c, 201);
  }],
  ["POST", /^issues\/(\d+)\/labels$/, (s, repo, m, { body, name }) => {
    const issue = repo.issues[m[1]];
    if (!issue) return notFound("issue");
    const labels = Array.isArray(body) ? body : body.labels ?? [];
    for (const l of labels) if (!issue.labels.includes(l)) issue.labels.push(l);
    record(s, "label", name, { issue: Number(m[1]), action: "add", labels });
    return ok(issue.labels.map((n) => ({ name: n })));
  }],
  ["DELETE", /^issues\/(\d+)\/labels\/(.+)$/, (s, repo, m, { name }) => {
    const issue = repo.issues[m[1]];
    if (!issue) return notFound("issue");
    const label = decodeURIComponent(m[2]);
    issue.labels = issue.labels.filter((l) => l !== label);
    record(s, "label", name, { issue: Number(m[1]), action: "remove", labels: [label] });
    return ok(issue.labels.map((n) => ({ name: n })));
  }],
  // pulls
  ["GET", /^pulls$/, (s, repo, _m, { query }) => {
    const want = query.state ?? "open";
    const head = query.head ? String(query.head) : null; // "owner:branch", as the real API wants it; a bare branch matches nothing
    return ok(Object.values(repo.pulls).filter((p) => (want === "all" || p.state === want) && (head === null || p.head.label === head)).map(asPull));
  }],
  ["GET", /^pulls\/(\d+)$/, (s, repo, m) => (repo.pulls[m[1]] ? ok(asPull(repo.pulls[m[1]])) : notFound("pull"))],
  ["PATCH", /^pulls\/(\d+)$/, (s, repo, m, { body, name }) => {
    const pr = repo.pulls[m[1]];
    if (!pr) return notFound("pull");
    const wasOpen = pr.state !== "closed";
    for (const key of ["state", "title", "body"]) if (key in body) pr[key] = body[key]; // nothing else is editable
    if (wasOpen && pr.state === "closed") record(s, "pull-close", name, { number: Number(m[1]) });
    return ok(asPull(pr));
  }],
  ["POST", /^pulls$/, (s, repo, _m, { body, name }) => {
    const number = s.nextId++;
    const pr = { number, state: "open", merged: false, title: body.title ?? "", body: body.body ?? "", base: { ref: body.base }, head: headOf(name, { head_ref: body.head.replace(/^[^:]*:/, ""), head_owner: body.head.includes(":") ? body.head.split(":")[0] : undefined }), html_url: `https://github.com/${name}/pull/${number}` };
    repo.pulls[number] = pr;
    record(s, "pull-create", name, { number, title: pr.title, head: body.head, base: body.base, body: pr.body });
    return ok(asPull(pr), 201);
  }],
  // compare: seeded as { "main...<sha>": "behind" | "identical" | "ahead" | "diverged" }; anything else is 404
  ["GET", /^compare\/(.+)$/, (s, repo, m) => (repo.compare[decodeURIComponent(m[1])] ? ok({ status: repo.compare[decodeURIComponent(m[1])] }) : notFound("compare"))],
  // commits
  ["GET", /^commits\/([^/]+)$/, (s, repo, m) => (repo.commits[m[1]] ? ok({ sha: m[1], files: repo.commits[m[1]].files.map((f) => (typeof f === "string" ? { filename: f } : f)) }) : notFound("commit"))],
  // contents: with `?ref=` only refFiles[ref] is read (a ref that is not seeded: 404); without it, `files`
  ["GET", /^contents\/(.+)$/, (s, repo, m, { query }) => {
    const files = query.ref ? repo.refFiles[query.ref] ?? {} : repo.files;
    return m[1] in files ? ok({ type: "file", path: m[1], encoding: "base64", content: Buffer.from(files[m[1]]).toString("base64") }) : notFound("file");
  }],
  // names only, as the real API lists them: no route returns a secret value
  ["GET", /^actions\/secrets$/, (s, repo) => ok({ total_count: repo.secrets.length, secrets: repo.secrets.map((name) => ({ name })) })],
  ["GET", /^labels$/, (s, repo) => ok(repo.labels.map((name) => ({ name })))],
  // Actions policies (Settings -> Actions -> Policies): the list shape of GitHub's REST "Actions policies" docs
  ["GET", /^actions\/policies$/, (s, repo) => ok({ total_count: repo.actionsPolicies.length, policies: repo.actionsPolicies })],
  ["GET", /^commits\/([^/]+)\/pulls$/, (s, repo, m) => ok((repo.commits[m[1]]?.pulls ?? []).map((n) => asPull(repo.pulls[n])).filter(Boolean))],
  ["GET", /^commits\/([^/]+)\/statuses$/, (s, repo, m) => ok(repo.statuses[m[1]] ?? [])],
  ["GET", /^commits\/([^/]+)\/status$/, (s, repo, m) => ok({ sha: m[1], ...combined(repo.statuses[m[1]] ?? []) })],
  ["POST", /^statuses\/([^/]+)$/, (s, repo, m, { body, name }) => {
    const st = { id: s.nextId++, creator: { login: "github-actions[bot]", type: "Bot" }, ...body }; // posted with the workflow token
    (repo.statuses[m[1]] ??= []).unshift(st); // newest first, as the list endpoint returns
    record(s, "status", name, { sha: m[1], ...body });
    return ok(st, 201);
  }],
];

export function handle(state, { method, path, query = {}, body = {} }) {
  const m = /^\/?repos\/([^/]+\/[^/]+)\/(.*)$/.exec(path);
  if (!m) throw new Unsupported(`path "${path}" is not under repos/{owner}/{repo}/`);
  const [, name, rest] = m;
  const repo = state.repos[name];
  if (!repo) return notFound(`repo ${name} not seeded`);
  for (const [verb, re, fn] of ROUTES) {
    if (verb !== method) continue;
    const mm = re.exec(rest);
    if (mm) {
      const res = fn(state, repo, mm, { query, body, name });
      if (method === "GET" && query.per_page && Array.isArray(res.body)) {
        const size = Number(query.per_page);
        const from = (Number(query.page ?? 1) - 1) * size;
        return { ...res, body: res.body.slice(from, from + size) };
      }
      return res;
    }
  }
  throw new Unsupported(`${method} ${path} is not implemented by the fake (add a route in test/harness/fake-github.mjs)`);
}
