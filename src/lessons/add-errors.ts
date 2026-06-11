import type { IneffectiveTrigger } from './trigger-effectiveness.js';

/**
 * Capture rejection errors thrown by {@link addLessonInto}. Kept in their own
 * module so `add.ts` stays focused on the mutation logic; re-exported from
 * `add.js` so every existing importer keeps its `from './add.js'` path.
 */

export class UnknownTopicError extends Error {
  readonly code = 'UNKNOWN_TOPIC';
  constructor(public readonly topic: string) {
    super(`Unknown topic: ${topic}. Pass allowNewTopic + topicSummary to create it.`);
    this.name = 'UnknownTopicError';
  }
}

/** Thrown when a capture would leave a lesson with no trigger (unrecallable). */
export class NoTriggerError extends Error {
  readonly code = 'NO_TRIGGER';
  constructor() {
    super(
      'A lesson needs at least one trigger to be recallable. Pass --trigger-file <glob> ' +
        '(preferred), --trigger-cmd <regex>, or --trigger-kw <text>.',
    );
    this.name = 'NoTriggerError';
  }
}

/**
 * Thrown when a capture would leave a lesson whose every trigger is dead on the
 * mandatory `--file`/`--cmd` recall path (a stopword-only keyword, an invalid or
 * ReDoS-shaped command regex). The lesson would be captured then silently never
 * recalled — so capture is rejected with the dead triggers named and a fix.
 */
export class UnrecallableLessonError extends Error {
  readonly code = 'UNRECALLABLE_LESSON';
  constructor(public readonly deadTriggers: readonly IneffectiveTrigger[]) {
    super(
      'This capture would create a lesson with no effective trigger — every trigger is dead ' +
        'on the mandatory --file/--cmd recall path, so the lesson could never be recalled there:\n' +
        deadTriggers.map((t) => `  • ${t.kind} "${t.pattern}" — ${t.reason}`).join('\n') +
        '\nFix: add a precise --trigger-file <glob> (preferred) or a valid --trigger-cmd <regex>; ' +
        'for a keyword, drop the stopwords (e.g. "state art" not "state of the art").',
    );
    this.name = 'UnrecallableLessonError';
  }
}
