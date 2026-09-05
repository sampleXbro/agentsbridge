import { describe, expect, it } from 'vitest';
import {
  COMMAND_PROBE_CORPUS,
  isBroadCommandPattern,
} from '../../../src/lessons/command-pattern-breadth.js';

describe('isBroadCommandPattern', () => {
  it.each(['.*', ' ', '.', '^', '$', '\\s', 'x*', '\\w', '[a-z]', '(git)?'])(
    'flags %j — it matches the empty string or most unrelated commands',
    (pattern) => {
      expect(isBroadCommandPattern(pattern)).toBe(true);
    },
  );

  it.each([
    '\\brm\\b',
    'git commit',
    '\\bgit\\b',
    'pnpm (test|lint)',
    '>',
    'sed|cat',
    '\\b(vitest|test)\\b',
    ' --global',
  ])('accepts the specific pattern %j', (pattern) => {
    expect(isBroadCommandPattern(pattern)).toBe(false);
  });

  it('leaves an invalid or unsafe pattern to the existing rejection (never "broad")', () => {
    expect(isBroadCommandPattern('(')).toBe(false);
    // A backreference is outside the linear engine (UNSAFE_TRIGGER_PATTERN);
    // `(a+)+` is NOT unsafe here — the engine runs it in linear time.
    expect(isBroadCommandPattern('(a)\\1')).toBe(false);
  });

  it('probes a fixed corpus of 20 unrelated commands', () => {
    expect(COMMAND_PROBE_CORPUS).toHaveLength(20);
    expect(new Set(COMMAND_PROBE_CORPUS).size).toBe(20);
  });
});
