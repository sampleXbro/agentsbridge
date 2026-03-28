import { describe, expect, it } from 'vitest';
import { suggestExtendName } from '../../../src/install/core/name-generator.js';

describe('suggestExtendName', () => {
  it('uses the repo name plus detected feature instead of the first picked item', () => {
    const name = suggestExtendName(
      {
        kind: 'github',
        rawRef: 'main',
        org: 'Njengah',
        repo: 'claude-code-cheat-sheet',
        gitRemoteUrl: 'https://github.com/Njengah/claude-code-cheat-sheet.git',
        pathInRepo: 'subagents',
      },
      { featureHint: 'agents' },
      new Set(),
    );

    expect(name).toBe('njengah-claude-code-cheat-sheet-agents');
  });

  it('falls back to the feature name for root installs', () => {
    const name = suggestExtendName(
      {
        kind: 'github',
        rawRef: 'main',
        org: 'org',
        repo: 'repo',
        gitRemoteUrl: 'https://github.com/org/repo.git',
        pathInRepo: '',
      },
      { featureHint: 'commands' },
      new Set(),
    );

    expect(name).toBe('org-repo-commands');
  });

  it('does not duplicate the feature when the path already names that collection', () => {
    const name = suggestExtendName(
      {
        kind: 'local',
        rawRef: '',
        localRoot: '/tmp/upstream',
        pathInRepo: 'commands',
      },
      { featureHint: 'commands' },
      new Set(),
    );

    expect(name).toBe('upstream-commands');
  });

  it('derives pack names from generic git remotes when no feature hint is provided', () => {
    const name = suggestExtendName(
      {
        kind: 'git',
        rawRef: 'main',
        gitRemoteUrl: 'https://git.example.com/team/platform.git',
        pathInRepo: '',
      },
      {},
      new Set(),
    );

    expect(name).toBe('team-platform-pack');
  });

  it('normalizes gitlab namespaces and falls back to local when the root is missing', () => {
    const gitlab = suggestExtendName(
      {
        kind: 'gitlab',
        rawRef: 'main',
        org: 'group/subgroup',
        repo: 'tooling',
        gitRemoteUrl: 'https://gitlab.com/group/subgroup/tooling.git',
        pathInRepo: '',
      },
      { featureHint: 'skills' },
      new Set(),
    );
    const local = suggestExtendName(
      {
        kind: 'local',
        rawRef: '',
        pathInRepo: '',
      },
      {},
      new Set(),
    );

    expect(gitlab).toBe('group-subgroup-tooling-skills');
    expect(local).toBe('local-pack');
  });

  it('falls back to generic names on invalid git urls and suffixes collisions', () => {
    const name = suggestExtendName(
      {
        kind: 'git',
        rawRef: 'main',
        gitRemoteUrl: 'not a valid git url',
        pathInRepo: '',
      },
      {},
      new Set(['repo-pack', 'repo-pack-2']),
    );

    expect(name).toBe('repo-pack-3');
  });

  it('uses the last segment when a git remote has only one path component', () => {
    const name = suggestExtendName(
      {
        kind: 'git',
        rawRef: 'main',
        gitRemoteUrl: 'https://git.example.com/repo.git',
        pathInRepo: '',
      },
      {},
      new Set(),
    );

    expect(name).toBe('repo-pack');
  });

  it('falls back to extend when no local root or remote identifiers are available', () => {
    const name = suggestExtendName(
      {
        kind: 'git',
        rawRef: 'main',
        pathInRepo: '',
      },
      { featureHint: 'rules' },
      new Set(),
    );

    expect(name).toBe('extend-rules');
  });
});
