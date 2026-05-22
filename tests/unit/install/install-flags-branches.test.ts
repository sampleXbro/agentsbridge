/**
 * Branch coverage for `readInstallFlags` in
 * `src/install/core/install-flags.ts`. Covers:
 *   - boolean defaults (sync/dryRun/force/useExtends/all) when flags absent
 *   - boolean flags set to true
 *   - explicit path/target/as: undefined when missing or empty-string
 *   - explicit path/target/as: trim + pass-through when set
 *   - nameOverride: trim + fallback to '' when not a string
 *   - explicitAs invalid → schema parse throws
 */
import { describe, it, expect } from 'vitest';
import { readInstallFlags } from '../../../src/install/core/install-flags.js';

describe('readInstallFlags', () => {
  it('returns boolean defaults of false / empty when nothing is provided', () => {
    expect(readInstallFlags({})).toEqual({
      sync: false,
      dryRun: false,
      force: false,
      useExtends: false,
      all: false,
      explicitPath: undefined,
      explicitTarget: undefined,
      explicitAs: undefined,
      nameOverride: '',
    });
  });

  it('flips every boolean when each flag is set to true', () => {
    const out = readInstallFlags({
      sync: true,
      'dry-run': true,
      force: true,
      extends: true,
      all: true,
    });
    expect(out.sync).toBe(true);
    expect(out.dryRun).toBe(true);
    expect(out.force).toBe(true);
    expect(out.useExtends).toBe(true);
    expect(out.all).toBe(true);
  });

  it('treats empty-string path/target/as the same as missing (undefined)', () => {
    const out = readInstallFlags({ path: '', target: '   ', as: '   ', name: '   ' });
    expect(out.explicitPath).toBeUndefined();
    expect(out.explicitTarget).toBeUndefined();
    expect(out.explicitAs).toBeUndefined();
    expect(out.nameOverride).toBe('');
  });

  it('trims target/as/name and pipes path through verbatim', () => {
    const out = readInstallFlags({
      path: 'src/some path',
      target: '  claude-code  ',
      as: '  skills  ',
      name: '  my-pack  ',
    });
    expect(out.explicitPath).toBe('src/some path');
    expect(out.explicitTarget).toBe('claude-code');
    expect(out.explicitAs).toBe('skills');
    expect(out.nameOverride).toBe('my-pack');
  });

  it('throws on an invalid `as` value because the schema rejects it', () => {
    expect(() => readInstallFlags({ as: 'totally-bogus' })).toThrow();
  });
});
