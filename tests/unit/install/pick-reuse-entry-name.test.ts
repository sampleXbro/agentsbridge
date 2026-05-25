/**
 * Branch coverage for `src/install/core/pick-reuse-entry-name.ts`. The
 * file has five early-return paths plus a name-equality helper — without
 * direct unit tests, only one path is exercised through the install
 * integration suite.
 */

import { describe, it, expect } from 'vitest';
import {
  pickReuseEntryName,
  sameFeatureSet,
} from '../../../src/install/core/pick-reuse-entry-name.js';
import type { InstallManifestEntry } from '../../../src/install/core/install-manifest.js';
import type { ParsedInstallSource } from '../../../src/install/source/parse-install-source.js';

function githubSource(org: string, repo: string): ParsedInstallSource {
  return {
    kind: 'github',
    org,
    repo,
    original: `github:${org}/${repo}`,
    normalized: `github:${org}/${repo}`,
  } as ParsedInstallSource;
}

function entry(overrides: Partial<InstallManifestEntry>): InstallManifestEntry {
  return {
    name: 'pack',
    source: 'github:org/repo',
    source_kind: 'github',
    features: ['rules'],
    ...overrides,
  } as InstallManifestEntry;
}

describe('sameFeatureSet', () => {
  it('returns true for equal sets regardless of order', () => {
    expect(sameFeatureSet(['rules', 'skills'], ['skills', 'rules'])).toBe(true);
  });
  it('returns false when lengths differ', () => {
    expect(sameFeatureSet(['rules'], ['rules', 'skills'])).toBe(false);
  });
  it('returns false when sets differ', () => {
    expect(sameFeatureSet(['rules', 'agents'], ['rules', 'skills'])).toBe(false);
  });
  it('returns true for two empty arrays', () => {
    expect(sameFeatureSet([], [])).toBe(true);
  });
});

describe('pickReuseEntryName', () => {
  const baseArgs = {
    entryFeatures: ['rules'] as readonly string[],
    yamlTarget: undefined,
    explicitAs: undefined,
  };

  it('returns null when there is no existing candidate', () => {
    const result = pickReuseEntryName({
      ...baseArgs,
      manifest: [],
      parsed: githubSource('acme', 'tools'),
    });
    expect(result).toBeNull();
  });

  it('returns the existing entry name when target/as/features all match', () => {
    const result = pickReuseEntryName({
      ...baseArgs,
      manifest: [
        entry({
          name: 'reused-pack',
          source: 'github:acme/tools',
          source_kind: 'github',
          features: ['rules'],
        }),
      ],
      parsed: githubSource('acme', 'tools'),
    });
    expect(result).toBe('reused-pack');
  });

  it('returns null when the existing entry has a different target', () => {
    const result = pickReuseEntryName({
      ...baseArgs,
      manifest: [
        entry({
          name: 'reused-pack',
          source: '/abs/path',
          source_kind: 'local',
          features: ['rules'],
          target: 'cursor',
        }),
      ],
      parsed: githubSource('acme', 'tools'),
      yamlTarget: undefined,
    });
    expect(result).toBeNull();
  });

  it('returns null when the existing entry has a different `as`', () => {
    const result = pickReuseEntryName({
      ...baseArgs,
      manifest: [
        entry({
          name: 'reused-pack',
          source: '/abs/path',
          source_kind: 'local',
          features: ['rules'],
          as: 'rules',
        }),
      ],
      parsed: githubSource('acme', 'tools'),
      explicitAs: undefined,
    });
    expect(result).toBeNull();
  });

  it('returns null when the feature sets diverge', () => {
    const result = pickReuseEntryName({
      ...baseArgs,
      manifest: [
        entry({
          name: 'reused-pack',
          source: '/abs/path',
          source_kind: 'local',
          features: ['rules', 'skills'],
        }),
      ],
      parsed: githubSource('acme', 'tools'),
      entryFeatures: ['rules'],
    });
    expect(result).toBeNull();
  });
});
