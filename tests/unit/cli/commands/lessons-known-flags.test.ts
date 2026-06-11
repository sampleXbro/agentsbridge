import { describe, it, expect } from 'vitest';
import {
  GLOBAL_FLAGS,
  LESSONS_KNOWN_FLAGS,
  validateLessonsFlags,
} from '../../../../src/cli/commands/lessons-known-flags.js';
import { LESSONS_SUBCOMMANDS, LESSONS_USAGE } from '../../../../src/cli/commands/lessons-usage.js';

/**
 * The known-flags allowlist is what makes a typoed flag a hard error instead of
 * silent data loss. These assertions tie it to LESSONS_USAGE (the documented
 * surface) so a handler that starts reading a new flag without documenting it —
 * or documenting one the validator would reject — fails CI.
 */
function documentedFlags(usage: string): string[] {
  return [...usage.matchAll(/--([a-z][a-z-]*)/g)].map((m) => m[1]!);
}

describe('LESSONS_KNOWN_FLAGS — parity with the documented usage', () => {
  it('has an allowlist for every dispatched subcommand', () => {
    expect(Object.keys(LESSONS_KNOWN_FLAGS).sort()).toEqual([...LESSONS_SUBCOMMANDS].sort());
  });

  it('every flag documented in a usage signature is accepted by the validator', () => {
    for (const sub of LESSONS_SUBCOMMANDS) {
      const known = new Set<string>([...(LESSONS_KNOWN_FLAGS[sub] ?? []), ...GLOBAL_FLAGS]);
      for (const flag of documentedFlags(LESSONS_USAGE[sub]!.usage)) {
        expect(known.has(flag), `${sub} usage documents --${flag} but it is not allowlisted`).toBe(
          true,
        );
      }
    }
  });

  it('allowlists the three previously-hidden query flags', () => {
    const q = new Set(LESSONS_KNOWN_FLAGS.query);
    expect(q.has('session')).toBe(true);
    expect(q.has('no-dedup')).toBe(true);
    expect(q.has('ids')).toBe(true);
  });
});

describe('validateLessonsFlags', () => {
  it('accepts a known flag', () => {
    expect(validateLessonsFlags('query', { file: 'src/a.ts' })).toBeNull();
  });

  it('accepts global flags on any subcommand', () => {
    expect(validateLessonsFlags('topics', { json: true })).toBeNull();
  });

  it('rejects an unknown flag and names it plus the usage', () => {
    const err = validateLessonsFlags('query', { fil: 'src/a.ts' });
    expect(err).not.toBeNull();
    expect(err).toContain('--fil');
    expect(err).toContain('lessons query');
    expect(err).toContain('Usage:');
  });

  it('rejects a typoed trigger flag on add (the data-loss case)', () => {
    const err = validateLessonsFlags('add', { rule: 'x', topic: 't', 'trigger-flie': 'src/**' });
    expect(err).toContain('--trigger-flie');
  });

  it('does not validate machine-invoked subcommands', () => {
    expect(validateLessonsFlags('hook', { anything: 'goes' })).toBeNull();
    expect(validateLessonsFlags('merge-driver', { x: 'y' })).toBeNull();
  });
});
