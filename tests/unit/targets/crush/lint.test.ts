import { describe, it, expect } from 'vitest';
import type { CanonicalFiles, CanonicalCommand } from '../../../../src/core/types.js';
import { lintCommands } from '../../../../src/targets/crush/lint.js';

function makeCanonical(commands: CanonicalCommand[]): CanonicalFiles {
  return {
    rules: [],
    commands,
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

function makeCommand(overrides: Partial<CanonicalCommand> = {}): CanonicalCommand {
  return {
    source: '.agentsmesh/commands/review.md',
    name: 'review',
    description: '',
    allowedTools: [],
    body: 'Review the diff.',
    ...overrides,
  };
}

describe('crush lintCommands', () => {
  it('returns no diagnostics when there are no commands', () => {
    const diagnostics = lintCommands(makeCanonical([]));
    expect(diagnostics).toEqual([]);
  });

  it('warns when commands are present', () => {
    const diagnostics = lintCommands(makeCanonical([makeCommand()]));

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].level).toBe('warning');
    expect(diagnostics[0].target).toBe('crush');
    expect(diagnostics[0].message).toContain('no native slash-command format');
    expect(diagnostics[0].message).toContain('supportsConversion');
  });

  it('warns once even with multiple commands', () => {
    const diagnostics = lintCommands(
      makeCanonical([
        makeCommand({ name: 'review' }),
        makeCommand({ name: 'deploy', source: '.agentsmesh/commands/deploy.md' }),
      ]),
    );

    expect(diagnostics).toHaveLength(1);
  });
});
