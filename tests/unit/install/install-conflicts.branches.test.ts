import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveInstallConflicts } from '../../../src/install/core/install-conflicts.js';
import * as prompts from '../../../src/install/core/prompts.js';
import type { CanonicalFiles } from '../../../src/core/types.js';

vi.mock('../../../src/install/core/prompts.js', () => ({
  confirm: vi.fn(),
}));

function emptyMerged(): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

describe('resolveInstallConflicts branch coverage', () => {
  beforeEach(() => {
    vi.mocked(prompts.confirm).mockReset();
  });

  it('does not prompt for non-colliding rules, commands, or agents', async () => {
    const result = await resolveInstallConflicts(emptyMerged(), {
      skills: [],
      rules: [
        {
          source: '/rules/new.md',
          root: false,
          targets: [],
          description: 'new rule',
          globs: ['src/**/*.ts'],
          body: '',
        },
      ],
      commands: [
        {
          source: '/commands/release.md',
          name: 'release',
          description: 'release command',
          allowedTools: [],
          body: '',
        },
      ],
      agents: [
        {
          source: '/agents/releaser.md',
          name: 'releaser',
          description: 'release agent',
          tools: [],
          disallowedTools: [],
          model: '',
          permissionMode: '',
          maxTurns: 0,
          mcpServers: [],
          hooks: {},
          skills: [],
          memory: '',
          body: '',
        },
      ],
    });

    expect(result).toEqual({
      skillNames: [],
      ruleSlugs: ['new'],
      commandNames: ['release'],
      agentNames: ['releaser'],
    });
    expect(prompts.confirm).not.toHaveBeenCalled();
  });

  it('keeps accepted duplicates and drops declined duplicates independently across categories', async () => {
    vi.mocked(prompts.confirm)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const merged = emptyMerged();
    merged.rules = [
      {
        source: '/rules/review.md',
        root: false,
        targets: [],
        description: 'review rule',
        globs: [],
        body: '',
      },
    ];
    merged.commands = [
      {
        source: '/commands/review.md',
        name: 'review',
        description: 'review command',
        allowedTools: [],
        body: '',
      },
    ];
    merged.agents = [
      {
        source: '/agents/reviewer.md',
        name: 'reviewer',
        description: 'review agent',
        tools: [],
        disallowedTools: [],
        model: '',
        permissionMode: '',
        maxTurns: 0,
        mcpServers: [],
        hooks: {},
        skills: [],
        memory: '',
        body: '',
      },
    ];

    const result = await resolveInstallConflicts(merged, {
      skills: [],
      rules: [{ ...merged.rules[0]! }],
      commands: [{ ...merged.commands[0]! }],
      agents: [{ ...merged.agents[0]! }],
    });

    expect(result.ruleSlugs).toEqual(['review']);
    expect(result.commandNames).toEqual(['review']);
    expect(result.agentNames).toEqual([]);
    expect(prompts.confirm).toHaveBeenCalledTimes(3);
  });
});
