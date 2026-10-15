// Stateful fake GitHub REST API. Pure: handle(state, request) mutates `state` and returns
// { status, body }. Throws Unsupported for routes it does not implement; add routes to ROUTES.
//
// State shape (JSON-serialisable, persisted between fake `gh` processes):
//   { repos: { "owner/name": { issues: {n: issue}, comments: {n: [c]}, pulls: {n: pr},
//                              commits: {sha: {pulls: [n]}}, statuses: {sha: [status]} } },
//     nextId, writes: [...], violations: [...], fires: [...], curl: {reject?} }

export class Unsupported extends Error {}

export function newState(seed = {}) {
  const state = { repos: {}, nextId: 1000, writes: [], violations: [], fires: [], curl: seed.curl ?? {} };
  const repos = { ...(seed.repos ?? {}) };
  if (seed.repo) repos[seed.repo] = seed;
  for (const [name, r] of Object.entries(repos)) {
    const repo = { issues: {}, comments: {}, pulls: {}, commits: {}, statuses: {} };
    for (const i of r.issues ?? []) {
      repo.issues[i.number] = { state: "open", body: "", user: { login: "someone" }, ...i, labels: [...(i.labels ?? [])] };
      repo.comments[i.number] = (i.comments ?? []).map((c) => ({ id: state.nextId++, user: { login: "someone" }, ...c }));
      delete repo.issues[i.number].comments;
    }
    for (const p of r.pulls ?? []) {
      repo.pulls[p.number] = { state: "open", merged: false, title: "", body: "", ...p, head: { sha: p.head_sha ?? p.head?.sha, ref: p.head_ref ?? p.head?.ref ?? "branch" } };
      delete repo.pulls[p.number].head_sha;
      delete repo.pulls[p.number].head_ref;
    }
    for (const c of r.commits ?? []) repo.commits[c.sha] = { pulls: c.pulls ?? [], files: c.files ?? [] };
    for (const [sha, list] of Object.entries(r.statuses ?? {})) repo.statuses[sha] = list.map((s) => ({ id: state.nextId++, ...s }));
    state.repos[name] = repo;
  }
  return state;
}

const notFound = (what) => ({ status: 404, body: { message: "Not Found", documentation_url: "https://docs.github.com/rest", detail: what } });
const ok = (body, status = 200) => ({ status, body });

const asIssue = (i) => ({ ...i, labels: i.labels.map((name) => ({ name })) });
const asPull = (p) => ({ ...p, labels: (p.labels ?? []).map((l) => (typeof l === "string" ? { name: l } : l)) });

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
    return ok(Object.values(repo.pulls).filter((p) => want === "all" || p.state === want).map(asPull));
  }],
  ["GET", /^pulls\/(\d+)$/, (s, repo, m) => (repo.pulls[m[1]] ? ok(asPull(repo.pulls[m[1]])) : notFound("pull"))],
  // commits
  ["GET", /^commits\/([^/]+)$/, (s, repo, m) => (repo.commits[m[1]] ? ok({ sha: m[1], files: repo.commits[m[1]].files.map((filename) => ({ filename })) }) : notFound("commit"))],
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
    if (mm) return fn(state, repo, mm, { query, body, name });
  }
  throw new Unsupported(`${method} ${path} is not implemented by the fake (add a route in test/harness/fake-github.mjs)`);
}
