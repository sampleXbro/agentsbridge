import { describe, it, expect } from 'vitest';
import type { CanonicalFiles, CanonicalCommand } from '../../../../src/core/types.js';
import { lintCommands } from '../../../../src/targets/qwen-code/lint.js';

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
    description: 'Review the diff',
    allowedTools: [],
    body: 'Review the diff.',
    ...overrides,
  };
}

describe('qwen-code lintCommands', () => {
  it('returns no diagnostics when there are no commands', () => {
    expect(lintCommands(makeCanonical([]))).toEqual([]);
  });

  it('is silent when allowedTools is empty', () => {
    expect(lintCommands(makeCanonical([makeCommand({ allowedTools: [] })]))).toEqual([]);
  });

  it('warns when a command declares allowedTools', () => {
    const diagnostics = lintCommands(
      makeCanonical([makeCommand({ allowedTools: ['Read', 'Bash'] })]),
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].level).toBe('warning');
    expect(diagnostics[0].target).toBe('qwen-code');
    expect(diagnostics[0].file).toBe('.agentsmesh/commands/review.md');
    expect(diagnostics[0].message).toContain('allowed-tools');
  });

  it('warns once per command with allowedTools, not once overall', () => {
    const diagnostics = lintCommands(
      makeCanonical([
        makeCommand({ name: 'review', allowedTools: ['Read'] }),
        makeCommand({
          name: 'deploy',
          source: '.agentsmesh/commands/deploy.md',
          allowedTools: ['Bash'],
        }),
        makeCommand({
          name: 'plain',
          source: '.agentsmesh/commands/plain.md',
          allowedTools: [],
        }),
      ]),
    );

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.map((d) => d.file)).toEqual([
      '.agentsmesh/commands/review.md',
      '.agentsmesh/commands/deploy.md',
    ]);
  });
});
