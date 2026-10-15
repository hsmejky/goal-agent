// REST-only GitHub access through `gh api` (ADR 0006: the cloud proxy rejects GraphQL-based gh
// subcommands). gh is called through a shell so a `gh` found on the PATH resolves on Windows too.
import { spawnSync } from "node:child_process";

export class GhError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/** `gh api <path>`; a JSON body (if any) is sent on stdin. Returns the parsed response. */
export function ghApi(path, { method = "GET", body } = {}) {
  const cmd = `gh api -X ${method} "${path}"${body === undefined ? "" : " --input -"}`;
  const r = spawnSync(cmd, { shell: true, encoding: "utf8", input: body === undefined ? undefined : JSON.stringify(body) });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    const status = /\(HTTP (\d+)\)/.exec(r.stderr ?? "")?.[1];
    throw new GhError(`gh api ${method} ${path} failed (${r.status}): ${(r.stderr || r.stdout || "").trim()}`, status ? Number(status) : undefined);
  }
  const text = (r.stdout ?? "").trim();
  return text ? JSON.parse(text) : null;
}

/** GET every page of a list endpoint. */
export function ghList(path) {
  const all = [];
  for (let page = 1; ; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const items = ghApi(`${path}${sep}per_page=100&page=${page}`);
    all.push(...items);
    if (items.length < 100) return all;
  }
}
