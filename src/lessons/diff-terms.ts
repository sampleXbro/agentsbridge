import { tokenize } from './ranking-text.js';

/**
 * Diff-aware recall: bind recall on the CHANGE, not just the file path. The
 * tool-call hook historically recalled against `file_path`/`command` only, so a
 * keyword-only (conceptual) lesson whose concept lives in the edited CONTENT —
 * "redos", "migration", "secret" — never fired unless the concept happened to
 * appear in the path. Here we extract a bounded token bag from the text a tool is
 * about to write (Edit `new_string`, Write `content`, MultiEdit `edits[].new_string`)
 * and fold it into the recall query's keyword, so those triggers match the change.
 *
 * Candidates still require a trigger hit — this only enlarges the keyword-match
 * surface, it never surfaces a lesson on shared incidental words alone.
 */

/** Cap the bag so a megabyte Write cannot build a giant keyword haystack. */
const MAX_DIFF_TERMS = 120;

interface DiffInput {
  readonly new_string?: unknown;
  readonly content?: unknown;
  readonly edits?: unknown;
}

/**
 * A bounded, de-duplicated, order-preserving token bag from the content a tool is
 * about to write. Empty when there is no writable content (a Bash command, a read,
 * a delete), which leaves the recall query untouched.
 */
export function diffTerms(input: DiffInput): string {
  const parts: string[] = [];
  const push = (v: unknown): void => {
    if (typeof v === 'string' && v.length > 0) parts.push(v);
  };
  push(input.new_string);
  push(input.content);
  if (Array.isArray(input.edits)) {
    for (const edit of input.edits) {
      if (edit !== null && typeof edit === 'object')
        push((edit as { new_string?: unknown }).new_string);
    }
  }
  if (parts.length === 0) return '';
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokenize(parts.join('\n'))) {
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(token);
    if (out.length >= MAX_DIFF_TERMS) break;
  }
  return out.join(' ');
}
