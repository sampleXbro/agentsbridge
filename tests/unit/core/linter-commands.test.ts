import { describe, expect, it } from 'vitest';
import type { CanonicalFiles, CanonicalCommand } from '../../../src/core/types.js';
import { lintCommands } from '../../../src/core/linter-commands.js';

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

describe('lintCommands', () => {
  it('returns no diagnostics when there are no commands', () => {
    expect(lintCommands(makeCanonical([]), 'copilot')).toEqual([]);
  });

  it('warns when copilot commands define allowed-tools', () => {
    const diagnostics = lintCommands(
      makeCanonical([makeCommand({ allowedTools: ['Bash(git diff)'] })]),
      'copilot',
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain('allowed-tools');
  });

  it('warns when cursor commands carry descriptions', () => {
    const diagnostics = lintCommands(
      makeCanonical([makeCommand({ description: 'Review code' })]),
      'cursor',
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain('Cursor command files are plain Markdown');
  });

  it('warns when cursor commands carry allowed-tools without descriptions', () => {
    const diagnostics = lintCommands(
      makeCanonical([makeCommand({ allowedTools: ['Read'] })]),
      'cursor',
    );

    expect(diagnostics).toHaveLength(1);
  });

  it('warns when gemini-cli commands carry allowed-tools', () => {
    const diagnostics = lintCommands(
      makeCanonical([makeCommand({ allowedTools: ['Read'] })]),
      'gemini-cli',
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain('Gemini TOML command files');
  });

  it('warns when continue commands carry allowed-tools', () => {
    const diagnostics = lintCommands(
      makeCanonical([makeCommand({ allowedTools: ['Read'] })]),
      'continue',
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain('Continue invokable prompt rules');
  });

  it('warns when cline workflows carry descriptions', () => {
    const diagnostics = lintCommands(
      makeCanonical([makeCommand({ description: 'Review code' })]),
      'cline',
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain('cline workflow files are plain Markdown');
  });

  it('warns when windsurf workflows carry allowed-tools without descriptions', () => {
    const diagnostics = lintCommands(
      makeCanonical([makeCommand({ allowedTools: ['Read'] })]),
      'windsurf',
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain('windsurf workflow files are plain Markdown');
  });

  it('does not warn when the target can project the command metadata', () => {
    const diagnostics = lintCommands(
      makeCanonical([makeCommand({ description: 'Review code', allowedTools: ['Read'] })]),
      'claude-code',
    );

    expect(diagnostics).toEqual([]);
  });
});
