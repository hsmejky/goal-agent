// The one shared halt-marker reader (R48). A State issue body is Halted when a line opens with
// `<!-- goal-agent:halted`. The guard reads it at SessionStart; the audit and the staleness check
// import it too, so there is exactly one definition of "carries the marker".
export const HALT_MARKER_PREFIX = "<!-- goal-agent:halted";

// The prefix must end at a boundary, so `goal-agent:halted-later` is not the marker.
const MARKER_LINE = /^<!-- goal-agent:halted(?=\s|-->|$)/;

/** The first body line that opens with the halt marker, or null. */
export function findHaltMarker(body) {
  if (typeof body !== "string") return null;
  for (const line of body.split(/\r?\n/)) if (MARKER_LINE.test(line)) return line;
  return null;
}

/** True when the issue body carries the halt marker. */
export function hasHaltMarker(body) {
  return findHaltMarker(body) !== null;
}
