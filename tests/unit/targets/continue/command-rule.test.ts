import { describe, expect, it } from 'vitest';
import type { CanonicalCommand } from '../../../../src/core/types.js';
import {
  continueCommandRulePath,
  parseCommandRuleFrontmatter,
  serializeCommandRule,
  serializeImportedCommand,
} from '../../../../src/targets/continue/command-rule.js';

function makeCommand(overrides: Partial<CanonicalCommand> = {}): CanonicalCommand {
  return {
    source: '.agentsbridge/commands/review.md',
    name: 'review',
    description: '',
    allowedTools: [],
    body: 'Review the diff.',
    ...overrides,
  };
}

describe('continue command rules', () => {
  it('builds the projected command prompt path in .continue/prompts/', () => {
    expect(continueCommandRulePath('review')).toBe('.continue/prompts/review.md');
  });

  it('serializes command prompts with round-trip metadata but without invokable flag', () => {
    const output = serializeCommandRule(
      makeCommand({
        description: 'Review the diff',
        allowedTools: ['Read', 'Bash(git diff)'],
      }),
    );

    expect(output).not.toContain('invokable:');
    expect(output).toContain('x-agentsbridge-kind: command');
    expect(output).toContain('x-agentsbridge-name: review');
    expect(output).toContain('x-agentsbridge-allowed-tools:');
  });

  it('parses command metadata from embedded x-agentsbridge frontmatter', () => {
    const parsed = parseCommandRuleFrontmatter(
      {
        'x-agentsbridge-kind': 'command',
        'x-agentsbridge-name': 'review',
        description: 'Review the diff',
        'x-agentsbridge-allowed-tools': 'Read, Bash(git diff)',
      },
      '.continue/prompts/review.md',
    );

    expect(parsed).toEqual({
      name: 'review',
      description: 'Review the diff',
      allowedTools: ['Read', 'Bash(git diff)'],
    });
  });

  it('derives command name from filename when x-agentsbridge-name is absent', () => {
    const parsed = parseCommandRuleFrontmatter(
      {
        description: 'Review the diff',
        'x-agentsbridge-allowed-tools': ['Read'],
      },
      '.continue/prompts/review.md',
    );

    expect(parsed).toEqual({
      name: 'review',
      description: 'Review the diff',
      allowedTools: ['Read'],
    });
  });

  it('serializes imported commands without empty metadata keys', () => {
    const output = serializeImportedCommand(
      {
        name: 'review',
        description: '',
        allowedTools: [],
      },
      'Review the diff.',
    );

    expect(output).not.toContain('description:');
    expect(output).not.toContain('allowed-tools:');
    expect(output).toContain('Review the diff.');
  });
});
