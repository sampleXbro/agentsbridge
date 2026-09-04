import { describe, it, expect } from 'vitest';
import { mergeConflictedLockOutputs } from '../../../src/core/lock-conflict-outputs.js';

function conflicted(ours: string[], theirs: string[], shared = 'checksums: {}'): string {
  return [shared, '<<<<<<< HEAD', ...ours, '=======', ...theirs, '>>>>>>> feature', ''].join('\n');
}

describe('mergeConflictedLockOutputs', () => {
  it('unions both sides', () => {
    const merged = mergeConflictedLockOutputs(
      conflicted(['outputs:', '  a.md: sha256:aaa'], ['outputs:', '  b.md: sha256:bbb']),
    );
    expect(merged).toEqual({ 'a.md': 'sha256:aaa', 'b.md': 'sha256:bbb' });
  });

  it('prefers our hash when both sides claim the same path', () => {
    const merged = mergeConflictedLockOutputs(
      conflicted(['outputs:', '  a.md: sha256:ours'], ['outputs:', '  a.md: sha256:theirs']),
    );
    expect(merged).toEqual({ 'a.md': 'sha256:ours' });
  });

  it('keeps outputs that sit outside the conflicted region', () => {
    const merged = mergeConflictedLockOutputs(
      [
        'outputs:',
        '  shared.md: sha256:s',
        '<<<<<<< HEAD',
        'lib_version: 1',
        '=======',
        'lib_version: 2',
        '>>>>>>> f',
        '',
      ].join('\n'),
    );
    expect(merged).toEqual({ 'shared.md': 'sha256:s' });
  });

  it('returns undefined when neither side has an outputs map', () => {
    expect(
      mergeConflictedLockOutputs(conflicted(['lib_version: 1'], ['lib_version: 2'])),
    ).toBeUndefined();
  });

  it('returns undefined for content with no conflict at all', () => {
    expect(mergeConflictedLockOutputs('checksums: {}\n')).toBeUndefined();
  });

  it('recovers the parsable side when the other is malformed YAML', () => {
    const merged = mergeConflictedLockOutputs(
      conflicted(['outputs:', '  a.md: sha256:aaa'], ['outputs:', '  : [unclosed']),
    );
    expect(merged).toEqual({ 'a.md': 'sha256:aaa' });
  });

  it('ignores non-string hash values', () => {
    const merged = mergeConflictedLockOutputs(
      conflicted(
        ['outputs:', '  a.md: sha256:aaa', '  bad.md:', '    nested: 1'],
        ['lib_version: 2'],
      ),
    );
    expect(merged).toEqual({ 'a.md': 'sha256:aaa' });
  });

  it('ignores an outputs key that is not a map', () => {
    expect(
      mergeConflictedLockOutputs(conflicted(['outputs: notamap'], ['outputs:', '  - a'])),
    ).toBeUndefined();
  });
});
