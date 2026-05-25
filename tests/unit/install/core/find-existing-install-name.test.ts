import { describe, expect, it } from 'vitest';
import { findExistingInstallName } from '../../../../src/install/core/install-name.js';
import type { InstallManifestEntry } from '../../../../src/install/core/install-manifest.js';
import type { ParsedInstallSource } from '../../../../src/install/source/install-source-types.js';

const baseEntry: InstallManifestEntry = {
  name: 'addyosmani-agent-skills',
  source: 'github:addyosmani/agent-skills@5b4c6da',
  source_kind: 'github',
  features: ['skills'],
};

describe('findExistingInstallName', () => {
  it('matches a parsed github source against a github:org/repo@sha manifest entry', () => {
    const parsed: ParsedInstallSource = {
      kind: 'github',
      rawRef: 'HEAD',
      org: 'addyosmani',
      repo: 'agent-skills',
      gitRemoteUrl: 'https://github.com/addyosmani/agent-skills.git',
      pathInRepo: '',
    };

    expect(findExistingInstallName([baseEntry], parsed)).toBe('addyosmani-agent-skills');
  });

  it('matches https://github.com/<org>/<repo>(.git) URL parsed source against existing entry', () => {
    const parsed: ParsedInstallSource = {
      kind: 'github',
      rawRef: 'HEAD',
      org: 'addyosmani',
      repo: 'agent-skills',
      gitRemoteUrl: 'https://github.com/addyosmani/agent-skills.git',
      pathInRepo: '',
    };

    expect(findExistingInstallName([baseEntry], parsed)).toBe('addyosmani-agent-skills');
  });

  it('matches git@github.com:org/repo.git SSH parsed source against existing entry', () => {
    const parsed: ParsedInstallSource = {
      kind: 'github',
      rawRef: 'HEAD',
      org: 'addyosmani',
      repo: 'agent-skills',
      gitRemoteUrl: 'https://github.com/addyosmani/agent-skills.git',
      pathInRepo: '',
    };

    expect(findExistingInstallName([baseEntry], parsed)).toBe('addyosmani-agent-skills');
  });

  it('matches across https / ssh / github: variants stored in different forms', () => {
    const parsed: ParsedInstallSource = {
      kind: 'github',
      rawRef: 'HEAD',
      org: 'AddyOsmani',
      repo: 'Agent-Skills',
      gitRemoteUrl: 'https://github.com/AddyOsmani/Agent-Skills.git',
      pathInRepo: '',
    };

    const httpsEntry: InstallManifestEntry = {
      name: 'addyosmani-agent-skills',
      source: 'https://github.com/addyosmani/agent-skills.git',
      source_kind: 'github',
      features: ['skills'],
    };
    const sshEntry: InstallManifestEntry = {
      name: 'addyosmani-agent-skills',
      source: 'git@github.com:addyosmani/agent-skills.git',
      source_kind: 'github',
      features: ['skills'],
    };
    const shorthandEntry: InstallManifestEntry = {
      name: 'addyosmani-agent-skills',
      source: 'github:addyosmani/agent-skills@5b4c6da',
      source_kind: 'github',
      features: ['skills'],
    };

    expect(findExistingInstallName([httpsEntry], parsed)).toBe('addyosmani-agent-skills');
    expect(findExistingInstallName([sshEntry], parsed)).toBe('addyosmani-agent-skills');
    expect(findExistingInstallName([shorthandEntry], parsed)).toBe('addyosmani-agent-skills');
  });

  it('returns null when no manifest entry matches', () => {
    const parsed: ParsedInstallSource = {
      kind: 'github',
      rawRef: 'HEAD',
      org: 'other-org',
      repo: 'other-repo',
      gitRemoteUrl: 'https://github.com/other-org/other-repo.git',
      pathInRepo: '',
    };

    expect(findExistingInstallName([baseEntry], parsed)).toBeNull();
  });

  it('returns null when manifest is empty', () => {
    const parsed: ParsedInstallSource = {
      kind: 'github',
      rawRef: 'HEAD',
      org: 'addyosmani',
      repo: 'agent-skills',
      gitRemoteUrl: 'https://github.com/addyosmani/agent-skills.git',
      pathInRepo: '',
    };

    expect(findExistingInstallName([], parsed)).toBeNull();
  });

  it('matches gitlab parsed source against gitlab:ns/proj@ref manifest entry', () => {
    const parsed: ParsedInstallSource = {
      kind: 'gitlab',
      rawRef: 'HEAD',
      org: 'team',
      repo: 'platform',
      gitRemoteUrl: 'https://gitlab.com/team/platform.git',
      pathInRepo: '',
    };
    const entry: InstallManifestEntry = {
      name: 'team-platform',
      source: 'gitlab:team/platform@main',
      source_kind: 'gitlab',
      features: ['rules'],
    };

    expect(findExistingInstallName([entry], parsed)).toBe('team-platform');
  });

  it('does not cross-match github vs gitlab when org/repo overlap', () => {
    const parsed: ParsedInstallSource = {
      kind: 'github',
      rawRef: 'HEAD',
      org: 'overlap',
      repo: 'name',
      gitRemoteUrl: 'https://github.com/overlap/name.git',
      pathInRepo: '',
    };
    const gitlabEntry: InstallManifestEntry = {
      name: 'overlap-name',
      source: 'gitlab:overlap/name@main',
      source_kind: 'gitlab',
      features: ['rules'],
    };

    expect(findExistingInstallName([gitlabEntry], parsed)).toBeNull();
  });

  it('returns null for local parsed sources (no canonical remote identity)', () => {
    const parsed: ParsedInstallSource = {
      kind: 'local',
      rawRef: '',
      localRoot: '/tmp/local-pack',
      pathInRepo: '',
    };

    expect(findExistingInstallName([baseEntry], parsed)).toBeNull();
  });
});
