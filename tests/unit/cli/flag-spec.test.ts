import { describe, it, expect } from 'vitest';
import { flagTakesValue } from '../../../src/cli/flag-spec.js';

describe('flagTakesValue (derived from the help table)', () => {
  it('reads value placeholders', () => {
    expect(flagTakesValue('generate', 'targets')).toBe(true);
    expect(flagTakesValue('import', 'from')).toBe(true);
    expect(flagTakesValue('lessons', 'session')).toBe(true);
    expect(flagTakesValue('lessons', 'format')).toBe(true);
    expect(flagTakesValue('lessons', 'scope')).toBe(true);
    expect(flagTakesValue('lessons', 'topic-summary')).toBe(true);
    expect(flagTakesValue('plugin', 'version')).toBe(true);
  });

  it('treats bare flags as booleans', () => {
    expect(flagTakesValue('refresh', 'dry-run')).toBe(false);
    expect(flagTakesValue('installs', 'global')).toBe(false);
    expect(flagTakesValue('check', 'no-outputs')).toBe(false);
    expect(flagTakesValue('lessons', 'new-topic')).toBe(false);
    expect(flagTakesValue('lessons', 'no-dedup')).toBe(false);
    expect(flagTakesValue('generate', 'json')).toBe(false);
  });

  it('returns undefined for flags the help table does not know', () => {
    expect(flagTakesValue('generate', 'bogus')).toBeUndefined();
    expect(flagTakesValue('nope', 'targets')).toBeUndefined();
  });
});
