import { describe, expect, it } from 'vitest';
import type { CanonicalFiles, CanonicalCommand } from '../../../src/core/types.js';
import { lintCommands as lintCopilotCommands } from '../../../src/targets/copilot/lint.js';
import { lintCommands as lintCursorCommands } from '../../../src/targets/cursor/lint.js';
import { lintCommands as lintGeminiCommands } from '../../../src/targets/gemini-cli/lint.js';
import { lintCommands as lintContinueCommands } from '../../../src/targets/continue/lint.js';
import { lintCommands as lintClineCommands } from '../../../src/targets/cline/lint.js';
import { lintCommands as lintWindsurfCommands } from '../../../src/targets/windsurf/lint.js';

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

describe('per-target lint.commands hooks', () => {
  it('returns no diagnostics when there are no commands', () => {
    expect(lintCopilotCommands(makeCanonical([]))).toEqual([]);
  });

  it('warns when copilot commands define allowed-tools', () => {
    const diagnostics = lintCopilotCommands(
      makeCanonical([makeCommand({ allowedTools: ['Bash(git diff)'] })]),
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain('allowed-tools');
  });

  it('warns when cursor commands carry descriptions', () => {
    const diagnostics = lintCursorCommands(
      makeCanonical([makeCommand({ description: 'Review code' })]),
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain('Cursor command files are plain Markdown');
  });

  it('warns when cursor commands carry allowed-tools without descriptions', () => {
    const diagnostics = lintCursorCommands(
      makeCanonical([makeCommand({ allowedTools: ['Read'] })]),
    );

    expect(diagnostics).toHaveLength(1);
  });

  it('warns when gemini-cli commands carry allowed-tools', () => {
    const diagnostics = lintGeminiCommands(
      makeCanonical([makeCommand({ allowedTools: ['Read'] })]),
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain('Gemini TOML command files');
  });

  it('warns when continue commands carry allowed-tools', () => {
    const diagnostics = lintContinueCommands(
      makeCanonical([makeCommand({ allowedTools: ['Read'] })]),
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain('Continue invokable prompt rules');
  });

  it('warns when cline workflows carry descriptions', () => {
    const diagnostics = lintClineCommands(
      makeCanonical([makeCommand({ description: 'Review code' })]),
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain('cline workflow files are plain Markdown');
  });

  it('warns when windsurf workflows carry allowed-tools without descriptions', () => {
    const diagnostics = lintWindsurfCommands(
      makeCanonical([makeCommand({ allowedTools: ['Read'] })]),
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain('windsurf workflow files are plain Markdown');
  });
});
