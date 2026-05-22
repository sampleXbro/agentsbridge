import { describe, it, expect } from 'vitest';
import { findExistingInstallName } from '../../../src/install/core/install-name.js';
import type { InstallManifestEntry } from '../../../src/install/core/install-manifest.js';
import type { ParsedInstallSource } from '../../../src/install/source/install-source-types.js';

function gitlabParsed(): ParsedInstallSource {
  return {
    kind: 'gitlab',
    rawRef: 'HEAD',
    org: 'team',
    repo: 'platform',
    gitRemoteUrl: 'https://gitlab.com/team/platform.git',
    pathInRepo: '',
  };
}

describe('findExistingInstallName — gitlab url variants', () => {
  it('matches gitlab: shorthand source against parsed gitlab source', () => {
    const entry: InstallManifestEntry = {
      name: 'team-platform',
      source: 'gitlab:team/platform@main',
      source_kind: 'gitlab',
      features: ['rules'],
    };
    expect(findExistingInstallName([entry], gitlabParsed())).toBe('team-platform');
  });

  it('matches https://gitlab.com/<ns>/<repo>(.git) sources', () => {
    const entry: InstallManifestEntry = {
      name: 'team-platform',
      source: 'https://gitlab.com/team/platform.git',
      source_kind: 'gitlab',
      features: ['rules'],
    };
    expect(findExistingInstallName([entry], gitlabParsed())).toBe('team-platform');
  });

  it('matches git@gitlab.com:<ns>/<repo>.git ssh sources', () => {
    const entry: InstallManifestEntry = {
      name: 'team-platform',
      source: 'git@gitlab.com:team/platform.git',
      source_kind: 'gitlab',
      features: ['rules'],
    };
    expect(findExistingInstallName([entry], gitlabParsed())).toBe('team-platform');
  });

  it('matches git+https://… by stripping the git+ prefix', () => {
    const entry: InstallManifestEntry = {
      name: 'team-platform',
      source: 'git+https://gitlab.com/team/platform.git#main',
      source_kind: 'gitlab',
      features: ['rules'],
    };
    expect(findExistingInstallName([entry], gitlabParsed())).toBe('team-platform');
  });

  it('strips multiple git+ prefixes iteratively without stack overflow', () => {
    const entry: InstallManifestEntry = {
      name: 'team-platform',
      source: 'git+git+git+https://gitlab.com/team/platform.git#main',
      source_kind: 'gitlab',
      features: ['rules'],
    };
    expect(findExistingInstallName([entry], gitlabParsed())).toBe('team-platform');
  });

  it('returns null when entry source is unrecognized', () => {
    const entry: InstallManifestEntry = {
      name: 'noop',
      source: 'totally-not-a-remote',
      source_kind: 'github',
      features: ['rules'],
    };
    expect(findExistingInstallName([entry], gitlabParsed())).toBeNull();
  });
});
