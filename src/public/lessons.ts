/**
 * Public API — lessons subsystem (package.json "exports"."./lessons").
 *
 * Re-exports a stable surface for the lessons recall + capture mechanism so
 * downstream consumers (CLI, future `agentsmesh init --lessons`, custom
 * tooling) can build on top without reaching into private modules.
 *
 * Stability contract:
 * - Functions and types exported here are stable.
 * - Anything under `src/lessons/` not re-exported here is internal and may
 *   change without notice.
 */

export { hashBullet } from '../lessons/bullet-hash.js';

export { parseBullets } from '../lessons/bullet-parser.js';
export type { ParsedBullet } from '../lessons/bullet-parser.js';

export { LessonsIndexSchema, parseIndex } from '../lessons/index-schema.js';
export type { LessonsIndex, LessonsCluster } from '../lessons/index-schema.js';

export { matchTriggers } from '../lessons/matcher.js';
export type { ToolEvent } from '../lessons/matcher.js';

export { loadLedger, saveLedger } from '../lessons/ledger.js';
export type { Ledger } from '../lessons/ledger.js';

export { scoreBullet } from '../lessons/scoring.js';
export type { ScoredCluster } from '../lessons/scoring.js';

export {
  lessonsPaths,
  toRelPath,
  LESSONS_JOURNAL_TEMPLATE,
  LESSONS_INDEX_TEMPLATE,
  LESSONS_PROCEDURAL_RULE,
} from '../lessons/paths.js';
export type { LessonsPaths } from '../lessons/paths.js';

export { scaffoldLessons } from '../lessons/init.js';
export type { ScaffoldLessonsResult } from '../lessons/init.js';
