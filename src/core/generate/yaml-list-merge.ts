/**
 * Marker-scoped merge for a YAML document holding a list the user also edits.
 *
 * Some tools keep a manifest the user hand-authors AND agentsmesh generates
 * into: Roo Code's `customModes`, Rovo Dev's saved-prompt `prompts`. There is no
 * key to scope ownership by, so it is recorded in the file — an `# agentsmesh:`
 * comment above every entry this tool emits, the same convention
 * `.aider.conf.yml` uses.
 *
 *   - a MARKED entry -> agentsmesh's, dropped and re-emitted from canonical,
 *     which is how a deleted canonical source loses its entry;
 *   - an entry whose id canonical still owns -> also replaced, so a file written
 *     by an older agentsmesh (no markers) does not end up duplicated;
 *   - anything else -> the user's, kept verbatim.
 *
 * Fields agentsmesh does not write are carried over within a replaced entry.
 */

import { Document, isMap, isSeq, parseDocument, parse as parseYaml, type Node } from 'yaml';

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMarked(item: Node | unknown): boolean {
  const comment = (item as { commentBefore?: unknown }).commentBefore;
  return typeof comment === 'string' && comment.includes('agentsmesh');
}

export interface YamlListMergeSpec {
  /** Top-level key holding the list (`customModes`, `prompts`). */
  readonly listKey: string;
  /** Field identifying an entry across runs (`slug`, `name`). */
  readonly idKey: string;
  /** Comment written above every generated entry; its presence proves ownership. */
  readonly marker: string;
}

/**
 * A new file is written through the same path so its entries carry the ownership
 * marker from the very first run — without it, the next run would read them back
 * as the user's and never revoke a deleted source.
 *
 * @returns Merged YAML, or the base verbatim when it is not a YAML mapping.
 */
export function mergeMarkedYamlList(
  base: string | null,
  newContent: string,
  spec: YamlListMergeSpec,
): string {
  let parsed: unknown;
  try {
    parsed = parseYaml(newContent);
  } catch {
    return base ?? newContent;
  }
  if (!isRecord(parsed) || !Array.isArray(parsed[spec.listKey])) return base ?? newContent;
  const entries = (parsed[spec.listKey] as unknown[]).filter(isRecord);

  const fresh = base === null || base.trim() === '';
  const doc = fresh ? new Document({}) : parseDocument(base);
  if (!fresh && (doc.errors.length > 0 || !isMap(doc.contents))) return base!;

  const ids = new Set(entries.map((entry) => entry[spec.idKey]));
  const seq = doc.get(spec.listKey, true);
  const existing = isSeq(seq) ? seq.items : [];
  // Re-parsing moves the comment above the FIRST item onto the sequence node
  // itself, so the first entry's marker arrives here. Without this the first
  // generated entry reads back as the user's and is never revoked.
  const firstMarked = isSeq(seq) && isMarked(seq);

  const kept: unknown[] = [];
  const carried = new Map<unknown, Json>();
  for (const [index, item] of existing.entries()) {
    const value: unknown = isMap(item) ? item.toJSON() : item;
    const id = isRecord(value) ? value[spec.idKey] : undefined;
    const marked = isMarked(item) || (index === 0 && firstMarked);
    if (marked || (id !== undefined && ids.has(id))) {
      if (isRecord(value)) carried.set(id, value);
      continue;
    }
    kept.push(item);
  }

  const emitted = entries.map((entry) => {
    const node = doc.createNode({ ...(carried.get(entry[spec.idKey]) ?? {}), ...entry });
    node.commentBefore = spec.marker;
    return node;
  });

  doc.set(spec.listKey, doc.createNode([]));
  const merged = doc.get(spec.listKey, true);
  if (isSeq(merged)) merged.items = [...kept, ...emitted];
  return doc.toString();
}
