/**
 * Normalize MCP `update_hooks` input to the flat canonical hook shape.
 *
 * The tool schema accepts both the flat canonical entry and the nested native
 * form (`{ matcher, hooks: [{ type, command|prompt, timeout }] }`) — the latter
 * is exactly what a client reads from a tool's settings.json. Canonical hooks
 * are flat (one callable per entry), and `parseHooks` only reads top-level
 * `command`/`prompt`, so a nested entry written verbatim is silently dropped on
 * the next generate. Flatten every nested entry into one flat entry per
 * callable, sharing the matcher, so both forms survive the round-trip.
 */

function flattenEntry(entry: unknown): Record<string, unknown>[] {
  if (!entry || typeof entry !== 'object') return [entry as Record<string, unknown>];
  const obj = entry as Record<string, unknown>;
  const nested = obj.hooks;
  if (!Array.isArray(nested)) return [obj];
  return nested.map((callable) => {
    const c = (callable && typeof callable === 'object' ? callable : {}) as Record<string, unknown>;
    return {
      matcher: obj.matcher,
      ...(c.type !== undefined && { type: c.type }),
      ...(c.command !== undefined && { command: c.command }),
      ...(c.prompt !== undefined && { prompt: c.prompt }),
      ...(c.timeout !== undefined && { timeout: c.timeout }),
    };
  });
}

/** Flatten any nested hook entries in a hooks record into flat canonical entries. */
export function normalizeHooksRecord(hooks: Record<string, unknown[]>): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {};
  for (const [event, entries] of Object.entries(hooks)) {
    out[event] = Array.isArray(entries) ? entries.flatMap(flattenEntry) : entries;
  }
  return out;
}
