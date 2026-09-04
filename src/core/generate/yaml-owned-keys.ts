/**
 * Key-scoped YAML merge for shared config files — the YAML twin of
 * `json-owned-keys.ts`, with the same contract: a target replaces only the
 * top-level keys it owns and keeps everything else byte-for-byte, so removing an
 * entry from canonical still revokes it while the user's keys survive.
 *
 * The merge goes through a `yaml` Document rather than parse/stringify so the
 * user's comments, key order and formatting outside the owned keys are kept.
 */

import { isMap, parseDocument, parse as parseYaml } from 'yaml';
import type { GeneratedOutputMerger } from '../../targets/catalog/target-descriptor.js';

function parseYamlObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = parseYaml(raw);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * @returns Merged YAML; the base verbatim when it is present but not a YAML
 * mapping (or does not parse — one syntax error must not cost the user the
 * file); or null when there is no base, so the caller writes the generated file.
 */
export function mergeOwnedYamlKeys(
  base: string | null,
  newContent: string,
  ownedKeys: readonly string[],
): string | null {
  if (base === null || base.trim() === '') return null;
  const incoming = parseYamlObject(newContent);
  if (incoming === null) return null;

  const doc = parseDocument(base);
  if (doc.errors.length > 0 || !isMap(doc.contents)) return base;
  // Transplant the generated NODE, not the plain JS value: re-stringifying a
  // value picks default scalar styles, so a `|-` block prompt came back folded
  // as `>-` and the merge stopped being byte-stable (`generate --check` then
  // reported drift on every run).
  const incomingDoc = parseDocument(newContent);
  for (const key of ownedKeys) {
    if (key in incoming) doc.set(key, incomingDoc.get(key, true));
  }
  return doc.toString();
}

/** Builds a `mergeGeneratedOutputContent` hook owning `ownedKeys` at `paths`. */
export function ownedYamlKeysMerger(
  paths: readonly string[],
  ownedKeys: readonly string[],
): GeneratedOutputMerger {
  return (existing, pending, newContent, resolvedPath) =>
    paths.includes(resolvedPath)
      ? mergeOwnedYamlKeys(pending?.content ?? existing, newContent, ownedKeys)
      : null;
}
