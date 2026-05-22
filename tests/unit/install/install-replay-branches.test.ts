/**
 * Branch coverage for `applyReplayInstallScope` in
 * `src/install/run/install-replay.ts`. Covers:
 *   - early return when neither `features` nor `pick` is provided
 *   - early return when `replay` is undefined
 *   - replay with `features` filter narrows the canonical snapshot
 *   - replay with `pick` filter narrows discoveredFeatures accordingly
 */
import { describe, it, expect } from 'vitest';
import { applyReplayInstallScope } from '../../../src/install/run/install-replay.js';
import type { CanonicalFiles } from '../../../src/core/types.js';

function makeCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
  return {
    skills: [],
    agents: [],
    commands: [],
    rules: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
    ...overrides,
  };
}

describe('applyReplayInstallScope', () => {
  it('passes through unchanged when replay is undefined', () => {
    const narrowed = makeCanonical({
      skills: [
        { name: 'a', frontmatter: { name: 'a', description: 'd' }, body: '', supportingFiles: [] },
      ],
    } as Partial<CanonicalFiles>);
    const out = applyReplayInstallScope(narrowed, ['skills']);
    expect(out.narrowed).toBe(narrowed);
    expect(out.discoveredFeatures).toEqual(['skills']);
  });

  it('passes through unchanged when replay has neither features nor pick', () => {
    const narrowed = makeCanonical();
    const out = applyReplayInstallScope(narrowed, [], {});
    expect(out.narrowed).toBe(narrowed);
    expect(out.discoveredFeatures).toEqual([]);
  });

  it('narrows by features (drops sections outside the replay feature list)', () => {
    const skill = {
      name: 's',
      frontmatter: { name: 's', description: 'd' },
      body: '',
      supportingFiles: [],
    };
    const rule = { source: '/p/rules/r.md', root: false, targets: [], body: '' };
    const narrowed = makeCanonical({ skills: [skill], rules: [rule] } as Partial<CanonicalFiles>);

    const out = applyReplayInstallScope(narrowed, ['skills', 'rules'], { features: ['skills'] });
    expect(out.narrowed.skills.length).toBe(1);
    expect(out.narrowed.rules.length).toBe(0);
    expect(out.discoveredFeatures).toEqual(['skills']);
  });
});
