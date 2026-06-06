/**
 * Public API — lessons subsystem (package.json "exports"."./lessons").
 *
 * Re-exports a stable surface for the JSON-graph recall + capture mechanism
 * so downstream consumers (CLI, MCP server, custom tooling) can build on top
 * without reaching into private modules.
 *
 * Stability contract:
 * - Functions and types exported here are stable.
 * - Anything under `src/lessons/` not re-exported here is internal and may
 *   change without notice.
 */

export { LessonsGraphSchema, parseGraph } from '../lessons/graph-schema.js';
export type {
  Lesson,
  LessonStatus,
  LessonsGraph,
  Topic,
  Trigger,
  TriggerKind,
} from '../lessons/graph-schema.js';

// Migration-aware application APIs — the BLESSED entry points. Each runs the
// legacy→JSON migration first, so callers never strand a legacy `index.yaml`.
// Prefer these over the low-level primitives below for ordinary recall/capture.
export { recallLessons, captureLesson } from '../lessons/recall.js';
export type { RecallOptions, RecallResult } from '../lessons/recall.js';

// The transactional write path. `mutateLessonsGraph` MIGRATES a legacy store
// first (so even a first raw write cannot strand `index.yaml`) — it is safe to
// use directly. Raw `saveLessonsGraph` is intentionally NOT exported — it
// bypasses locking and validation; use `mutateLessonsGraph` so the transaction
// boundary (lock → load → mutate → validate → atomic save) cannot be
// circumvented.
export { mutateLessonsGraph } from '../lessons/mutate.js';
export type { MutateOptions } from '../lessons/mutate.js';

// Low-level READ primitives. NOTE: these do NOT migrate — a first read via them
// on a legacy project sees no graph. Use `recallLessons` (migrating) for recall,
// or call `maybeAutoMigrateLessons` first.
export {
  graphFilePath,
  loadLessonsGraph,
  serializeGraph,
  tryLoadLessonsGraph,
} from '../lessons/graph-store.js';

export { maybeAutoMigrateLessons } from '../lessons/auto-migrate.js';

export { queryLessons } from '../lessons/query.js';
export type { LessonsQuery, MatchedLesson } from '../lessons/query.js';

export {
  rankLessons,
  DEFAULT_RECALL_LIMIT,
  DEFAULT_RECALL_MAX_TOKENS,
} from '../lessons/ranking.js';
export type { RankedLesson, RankOptions, RankReason } from '../lessons/ranking.js';

export { isSafeRegexPattern } from '../lessons/regex-safety.js';

export { mergeLessons } from '../lessons/merge.js';
export type { MergeLessonsOptions, MergeLessonsResult } from '../lessons/merge.js';

export { stripLegacyMarkers, stripMarkersInGraph } from '../lessons/strip-markers.js';
export type { StripMarkersOptions, StripMarkersReport } from '../lessons/strip-markers.js';

export { addLesson, UnknownTopicError } from '../lessons/add.js';
export type {
  AddLessonInput,
  AddLessonOptions,
  AddLessonResult,
  AddLessonTriggers,
} from '../lessons/add.js';

export { validateLessonsGraph } from '../lessons/validate.js';
export type { ValidationFinding, ValidationLevel, ValidationReport } from '../lessons/validate.js';

export { importLegacyLessons, LessonsGraphExistsError } from '../lessons/import-legacy.js';
export type { ImportLegacyOptions, ImportLegacyReport } from '../lessons/import-legacy.js';

export {
  acquireLessonsLock,
  lessonsLockPath,
  LESSONS_LOCK_FILENAME,
} from '../lessons/lessons-lock.js';

export { lessonsPaths, toRelPath, LESSONS_PROCEDURAL_RULE } from '../lessons/paths.js';
export type { LessonsPaths } from '../lessons/paths.js';

export { scaffoldLessons } from '../lessons/init.js';
export type { ScaffoldLessonsResult } from '../lessons/init.js';
