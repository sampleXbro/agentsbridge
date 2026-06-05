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

export {
  graphFilePath,
  loadLessonsGraph,
  saveLessonsGraph,
  serializeGraph,
  tryLoadLessonsGraph,
} from '../lessons/graph-store.js';

export { queryLessons } from '../lessons/query.js';
export type { LessonsQuery, MatchedLesson } from '../lessons/query.js';

export { addLesson, UnknownTopicError } from '../lessons/add.js';
export type {
  AddLessonInput,
  AddLessonOptions,
  AddLessonResult,
  AddLessonTriggers,
} from '../lessons/add.js';

export { validateLessonsGraph } from '../lessons/validate.js';
export type { ValidationFinding, ValidationLevel, ValidationReport } from '../lessons/validate.js';

export { importLegacyLessons } from '../lessons/import-legacy.js';
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
