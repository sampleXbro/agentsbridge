import { describe, expect, it } from 'vitest';
import type { CanonicalCommand } from '../../../../src/core/types.js';
import {
  commandSkillDirName,
  parseCommandSkillFrontmatter,
  serializeCommandSkill,
  serializeImportedCommand,
} from '../../../../src/targets/codex-cli/command-skill.js';

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

describe('codex command skill helpers', () => {
  it('builds command skill directory names', () => {
    expect(commandSkillDirName('review')).toBe('am-command-review');
  });

  it('serializes command skills with x-agentsmesh metadata', () => {
    const output = serializeCommandSkill(
      makeCommand({
        description: 'Review changes',
        allowedTools: ['Read', 'Bash(git diff)'],
      }),
    );

    expect(output).toContain('name: am-command-review');
    expect(output).toContain('description: Review changes');
    expect(output).toContain('x-agentsmesh-kind: command');
    expect(output).toContain('x-agentsmesh-allowed-tools:');
  });

  it('omits optional metadata when command description and tools are empty', () => {
    const output = serializeCommandSkill(makeCommand());

    expect(output).toContain('name: am-command-review');
    expect(output).not.toContain('description:');
    expect(output).not.toContain('x-agentsmesh-allowed-tools:');
  });

  it('returns null when command skill metadata kind is absent', () => {
    expect(parseCommandSkillFrontmatter({}, 'am-command-review')).toBeNull();
  });

  it('returns null when command name cannot be derived', () => {
    expect(parseCommandSkillFrontmatter({ 'x-agentsmesh-kind': 'command' }, 'review')).toBeNull();
  });

  it('parses command metadata from modern and legacy skill directory names', () => {
    expect(
      parseCommandSkillFrontmatter(
        {
          'x-agentsmesh-kind': 'command',
          description: 'Review changes',
          'x-agentsmesh-allowed-tools': 'Read, Bash(git diff)',
        },
        'ab-command-review',
      ),
    ).toEqual({
      name: 'review',
      description: 'Review changes',
      allowedTools: ['Read', 'Bash(git diff)'],
    });
  });

  it('prefers metadata name over derived directory name', () => {
    expect(
      parseCommandSkillFrontmatter(
        {
          'x-agentsmesh-kind': 'command',
          'x-agentsmesh-name': 'explicit-review',
        },
        'am-command-review',
      ),
    ).toEqual({
      name: 'explicit-review',
      description: '',
      allowedTools: [],
    });
  });

  it('serializes imported commands with placeholder metadata', () => {
    const output = serializeImportedCommand(
      { name: 'review', description: '', allowedTools: [] },
      'Review the diff.',
    );

    expect(output).toContain('description: ""');
    expect(output).toContain('allowed-tools: []');
    expect(output).toContain('Review the diff.');
  });
});
