import { describe, expect, it } from 'vitest';
import { suggestExtendName } from '../../../src/install/name-generator.js';

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
});
