/**
 * Key-scoped JSON merge for shared config files.
 *
 * A target that writes into a file the user also owns replaces only the keys it
 * owns and keeps everything else byte-for-byte. The merge is key-scoped, never
 * file-scoped, so removing a server from canonical still revokes it: the owned
 * key is replaced wholesale, not deep-merged.
 */

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Guard for mergers that parse the user's file before rewriting it.
 *
 * A base we cannot parse as a JSON object is a file we do not understand:
 * `.vscode/settings.json`, `kilo.jsonc` and `.qwen/settings.json` are all
 * comment-legal, and coercing an unparsable base to `{}` before serialising
 * over it costs the user every key in the file.
 *
 * @returns The base verbatim when it must be preserved, or null to proceed with
 * a normal merge (a blank base is "nothing to preserve", so the caller writes
 * the generated file).
 */
export function preservedUnparsableBase(base: string): string | null {
  if (base.trim() === '') return null;
  return parseJsonObject(base) === null ? base : null;
}

/**
 * @returns Merged JSON; the base verbatim when it is present but not a JSON
 * object; or null when there is no base to merge into (so the caller writes the
 * generated file).
 *
 * A base we cannot parse is a file we do not understand — JSONC comments are
 * legal in `.vscode/mcp.json` and `.qwen/settings.json`. Returning null there
 * would fall through to the default policy, which replaces the whole file and
 * destroys the user's keys. Preserving it is the same rule
 * `src/targets/zed/layout.ts` documents: never rewrite a file whose comments we
 * would drop.
 */
export function mergeOwnedJsonKeys(
  base: string | null,
  newContent: string,
  ownedKeys: readonly string[],
): string | null {
  if (base === null || base.trim() === '') return null;
  const incoming = parseJsonObject(newContent);
  if (incoming === null) return null;
  const baseObject = parseJsonObject(base);
  if (baseObject === null) return base;
  const merged: Record<string, unknown> = { ...baseObject };
  for (const key of ownedKeys) {
    if (key in incoming) merged[key] = incoming[key];
  }
  return JSON.stringify(merged, null, 2);
}

/**
 * Builds a `mergeGeneratedOutputContent` hook that owns `ownedKeys` at any of
 * `paths`. Targets sharing a path (`.mcp.json` is written by both claude-code
 * and deepagents-cli) MUST use the same owned-key set, or their output differs
 * and `resolveOutputCollisions` hard-fails the run.
 */
export function ownedJsonKeysMerger(
  paths: readonly string[],
  ownedKeys: readonly string[],
): (
  existing: string | null,
  pending: { readonly content: string } | undefined,
  newContent: string,
  resolvedPath: string,
) => string | null {
  return (existing, pending, newContent, resolvedPath) =>
    paths.includes(resolvedPath)
      ? mergeOwnedJsonKeys(pending?.content ?? existing, newContent, ownedKeys)
      : null;
}
