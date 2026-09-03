/**
 * Mode-scoped merge for `~/.roo/settings/custom_modes.yaml`.
 *
 * Roo Code writes this file itself every time the user creates a mode at Global
 * scope, so the list is shared. There is no key to scope ownership by, so it is
 * recorded in the file: a `# agentsmesh:` comment above every mode this tool
 * emits, the same convention `.aider.conf.yml` uses.
 *
 *   - a MARKED mode -> agentsmesh's, dropped and re-emitted from canonical,
 *     which is how an agent deleted from `.agentsmesh/agents/` loses its mode;
 *   - a mode whose slug canonical still owns -> also replaced, so a file written
 *     by an older agentsmesh (no markers) does not end up duplicated;
 *   - anything else -> the user's, kept verbatim.
 *
 * Within a replaced mode, fields agentsmesh does not write are carried over:
 * `whenToUse` and `customInstructions` are first-class Roo mode fields with no
 * canonical equivalent, and `iconName` / per-mode model bindings likewise.
 */

import { Document, isMap, isSeq, parseDocument, parse as parseYaml, type Node } from 'yaml';
import type { GeneratedOutputMerger } from '../catalog/target-descriptor.js';
import { ROO_CODE_GLOBAL_MODES_FILE } from './constants.js';

/** Written above every mode agentsmesh emits; its presence is the ownership proof. */
export const ROO_MODE_MARKER = ' agentsmesh: generated from .agentsmesh/agents/ — do not edit';

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function incomingModes(newContent: string): Json[] | null {
  let parsed: unknown;
  try {
    parsed = parseYaml(newContent);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.customModes)) return null;
  return parsed.customModes.filter(isRecord);
}

function isMarked(item: Node | unknown): boolean {
  const comment = (item as { commentBefore?: unknown }).commentBefore;
  return typeof comment === 'string' && comment.includes('agentsmesh');
}

/**
 * A new file is written through the same path so its modes carry the ownership
 * marker from the very first run — without it, the next run would read them back
 * as the user's and never revoke a deleted agent.
 *
 * @returns Merged YAML, or the base verbatim when it is not a YAML mapping
 */
export function mergeRooCustomModes(base: string | null, newContent: string): string {
  const modes = incomingModes(newContent);
  if (modes === null) return base ?? newContent;

  const fresh = base === null || base.trim() === '';
  const doc = fresh ? new Document({}) : parseDocument(base);
  if (!fresh && (doc.errors.length > 0 || !isMap(doc.contents))) return base!;

  const slugs = new Set(modes.map((mode) => mode.slug));
  const seq = doc.get('customModes', true);
  const existing = isSeq(seq) ? seq.items : [];

  const kept: unknown[] = [];
  const carried = new Map<unknown, Json>();
  for (const item of existing) {
    const value: unknown = isMap(item) ? item.toJSON() : item;
    const slug = isRecord(value) ? value.slug : undefined;
    if (isMarked(item) || (slug !== undefined && slugs.has(slug))) {
      if (isRecord(value)) carried.set(slug, value);
      continue;
    }
    kept.push(item);
  }

  const emitted = modes.map((mode) => {
    const node = doc.createNode({ ...(carried.get(mode.slug) ?? {}), ...mode });
    node.commentBefore = ROO_MODE_MARKER;
    return node;
  });

  doc.set('customModes', doc.createNode([]));
  const merged = doc.get('customModes', true);
  if (isSeq(merged)) merged.items = [...kept, ...emitted];
  return doc.toString();
}

export const mergeRooCustomModesYaml: GeneratedOutputMerger = (
  existing,
  pending,
  newContent,
  resolvedPath,
) =>
  resolvedPath === ROO_CODE_GLOBAL_MODES_FILE
    ? mergeRooCustomModes(pending?.content ?? existing, newContent)
    : null;
