import { maybeAutoMigrateLessons } from './auto-migrate.js';
import type { LessonsGraph } from './graph-schema.js';
import { tryLoadLessonsGraph } from './graph-store.js';
import { mutateLessonsGraph } from './mutate.js';

export interface StripMarkersReport {
  readonly changedIds: string[];
  readonly changedCount: number;
}

export interface StripMarkersOptions {
  readonly dryRun?: boolean;
}

/** One or more `L\d+` line refs, optionally comma-separated: `L92`, `L92, L163`. */
const LINE_REFS = String.raw`L\d+(?:\s*,\s*L\d+)*`;

/**
 * Line-ref markers. Each carries a leading `\s*` so it absorbs the single space
 * that precedes it; removing the whole match (replacing with the empty string)
 * leaves surrounding prose spacing intact, whether the marker sits at the end
 * of a clause ("Do X. See L1") or mid-sentence ("First clause (L1, L2), then").
 */
const LINE_REF_PATTERNS: readonly RegExp[] = [
  new RegExp(String.raw`\s*\bSee\s+${LINE_REFS}\.?`, 'g'), // " See L128." / " See L140, L149"
  new RegExp(String.raw`\s*\((?:${LINE_REFS})\)\.?`, 'g'), // " (L174)" / " (L92, L163)"
  new RegExp(String.raw`\s*\[(?:${LINE_REFS})\]\.?`, 'g'), // " [L161, L208]"
];

/**
 * The "(also relevant …)" cross-reference phrase. Replaced with a single space
 * (not empty) so a mid-sentence occurrence does not glue its neighbours
 * together; a leading/trailing occurrence is cleaned up by the final trim.
 */
const ALSO_RELEVANT_PATTERN = /\s*\(also relevant[^)]*\)\s*/g;

/**
 * Strip dead legacy provenance markers from a lesson's prose. The migration
 * from the line-numbered Markdown store left inline `See L\d+`, `(L\d+)`,
 * `[L\d+]`, and "(also relevant …)" pointers that no longer resolve to
 * anything. Real provenance lives in the `evidence` array, not the rule text.
 *
 * Strictly conservative: ONLY the four marker shapes are touched. Legitimate
 * parentheticals like `(CWE-78)`, ellipses inside code spans, block-comment
 * fences, and shell punctuation (`exit 1 ;;`) are left byte-for-byte intact.
 * Idempotent.
 */
export function stripLegacyMarkers(rule: string): string {
  let out = rule;
  for (const pattern of LINE_REF_PATTERNS) out = out.replace(pattern, '');
  out = out.replace(ALSO_RELEVANT_PATTERN, ' ');
  return out.trim();
}

/** Strip markers from every lesson in `graph` in place; returns changed ids (sorted). */
function applyStrip(graph: LessonsGraph): string[] {
  const changedIds: string[] = [];
  for (const [id, lesson] of Object.entries(graph.lessons)) {
    const stripped = stripLegacyMarkers(lesson.rule);
    // Never blank a rule: if a rule were entirely markers, keep the original
    // (the schema forbids empty rules, and a blank rule carries no knowledge).
    if (stripped === lesson.rule || stripped.length === 0) continue;
    changedIds.push(id);
    graph.lessons[id] = { ...lesson, rule: stripped };
  }
  return changedIds.sort();
}

/**
 * Apply {@link stripLegacyMarkers} to every lesson. With `dryRun`, computes the
 * change set without persisting; otherwise writes through the transactional
 * path (locked + validated + atomic). A legacy-only store is migrated first (the
 * universal first-access upgrade) so its lessons are stripped rather than
 * silently ignored. No-op (and no file creation) when neither graph nor legacy
 * store exists.
 */
export async function stripMarkersInGraph(
  projectRoot: string,
  options: StripMarkersOptions = {},
): Promise<StripMarkersReport> {
  // Migrate a legacy-only store first; otherwise tryLoadLessonsGraph returns null
  // and a real legacy store would be silently skipped.
  await maybeAutoMigrateLessons(projectRoot);
  const existing = tryLoadLessonsGraph(projectRoot);
  if (existing === null) return { changedIds: [], changedCount: 0 };

  if (options.dryRun === true) {
    const changedIds = applyStrip(existing); // mutates the throwaway in-memory copy only
    return { changedIds, changedCount: changedIds.length };
  }

  let changedIds: string[] = [];
  await mutateLessonsGraph(projectRoot, (graph) => {
    changedIds = applyStrip(graph);
  });
  return { changedIds, changedCount: changedIds.length };
}
