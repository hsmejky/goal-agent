// The guard restricts only cloud sessions (R45, ADR 0007); tests that exercise its denies run as one.
export const CLOUD_ENV = { CLAUDE_CODE_REMOTE: "true" };
