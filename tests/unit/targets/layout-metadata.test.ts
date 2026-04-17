import { describe, expect, it } from 'vitest';
import {
  getTargetLayout,
  getTargetManagedOutputs,
  getTargetPrimaryRootInstructionPath,
  getTargetDetectionPaths,
} from '../../../src/targets/catalog/builtin-targets.js';

describe('target layout metadata', () => {
  it('returns the project layout for claude-code', () => {
    const layout = getTargetLayout('claude-code');

    expect(layout?.rootInstructionPath).toBe('.claude/CLAUDE.md');
    expect(layout?.skillDir).toBe('.claude/skills');
    expect(
      layout?.paths.rulePath('example', {
        source: 'example.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
      }),
    ).toBe('.claude/rules/example.md');
  });

  it('returns managed outputs from descriptor metadata', () => {
    expect(getTargetManagedOutputs('codex-cli')).toEqual({
      dirs: ['.agents/skills', '.codex/agents', '.codex/instructions'],
      files: ['AGENTS.md', '.codex/config.toml'],
    });
  });

  it('returns the primary root instruction path from layout metadata', () => {
    expect(getTargetPrimaryRootInstructionPath('cursor')).toBe('.cursor/rules/general.mdc');
  });

  it('lists extra root-decoration paths for Cursor project layout', () => {
    expect(getTargetLayout('cursor')).toEqual(
      expect.objectContaining({
        rootInstructionPath: '.cursor/rules/general.mdc',
        additionalRootDecorationPaths: ['AGENTS.md', '.cursor/AGENTS.md'],
      }),
    );
  });

  it('lists extra root-decoration paths for Gemini CLI project layout', () => {
    expect(getTargetLayout('gemini-cli')).toEqual(
      expect.objectContaining({
        rootInstructionPath: 'GEMINI.md',
        additionalRootDecorationPaths: ['AGENTS.md'],
      }),
    );
  });

  it('returns undefined for missing global layout metadata', () => {
    expect(getTargetLayout('claude-code', 'global')).toEqual(
      expect.objectContaining({
        rootInstructionPath: '.claude/CLAUDE.md',
        skillDir: '.claude/skills',
        managedOutputs: {
          dirs: [
            '.claude/agents',
            '.claude/commands',
            '.claude/rules',
            '.claude/skills',
            '.claude/output-styles',
            '.agents/skills',
          ],
          files: [
            '.claude/CLAUDE.md',
            '.claude/settings.json',
            '.claude.json',
            '.claude/hooks.json',
            '.claudeignore',
          ],
        },
        paths: expect.objectContaining({
          rulePath: expect.any(Function),
          commandPath: expect.any(Function),
          agentPath: expect.any(Function),
        }),
        renderPrimaryRootInstruction: expect.any(Function),
        rewriteGeneratedPath: expect.any(Function),
      }),
    );
  });

  it('returns the Antigravity global layout metadata', () => {
    const layout = getTargetLayout('antigravity', 'global');
    expect(layout).toEqual(
      expect.objectContaining({
        rootInstructionPath: '.gemini/antigravity/GEMINI.md',
        skillDir: '.gemini/antigravity/skills',
        managedOutputs: {
          dirs: ['.gemini/antigravity/skills', '.gemini/antigravity/workflows'],
          files: ['.gemini/antigravity/GEMINI.md', '.gemini/antigravity/mcp_config.json'],
        },
        paths: expect.objectContaining({
          rulePath: expect.any(Function),
          commandPath: expect.any(Function),
          agentPath: expect.any(Function),
        }),
      }),
    );
    const mockConfig = {} as import('../../../../src/config/core/schema.js').ValidatedConfig;
    expect(layout?.paths.commandPath('deploy', mockConfig)).toBe(
      '.gemini/antigravity/workflows/deploy.md',
    );
  });

  it('lists Cursor global detection paths for ~/.cursor rules and tooling', () => {
    expect(getTargetDetectionPaths('cursor', 'global')).toEqual([
      '.cursor/rules/general.mdc',
      '.cursor/AGENTS.md',
      '.cursor/mcp.json',
      '.cursor/hooks.json',
      '.cursorignore',
      '.cursor/skills',
      '.cursor/agents',
      '.cursor/commands',
      '.agentsmesh-exports/cursor/user-rules.md',
    ]);
  });

  it('returns the Cursor global layout metadata', () => {
    expect(getTargetLayout('cursor', 'global')).toEqual(
      expect.objectContaining({
        rootInstructionPath: '.cursor/rules/general.mdc',
        additionalRootDecorationPaths: ['AGENTS.md', '.cursor/AGENTS.md'],
        skillDir: '.cursor/skills',
        managedOutputs: {
          dirs: ['.cursor/rules', '.cursor/commands', '.cursor/agents', '.cursor/skills'],
          files: [
            '.cursor/rules/general.mdc',
            '.cursor/AGENTS.md',
            '.cursor/mcp.json',
            '.cursor/hooks.json',
            '.cursorignore',
            '.agentsmesh-exports/cursor/user-rules.md',
          ],
        },
        paths: expect.objectContaining({
          rulePath: expect.any(Function),
          commandPath: expect.any(Function),
          agentPath: expect.any(Function),
        }),
      }),
    );
  });

  it('returns the Codex global layout metadata', () => {
    expect(getTargetLayout('codex-cli', 'global')).toEqual(
      expect.objectContaining({
        rootInstructionPath: '.codex/AGENTS.md',
        skillDir: '.agents/skills',
        managedOutputs: {
          dirs: ['.agents/skills', '.codex/agents', '.codex/rules'],
          files: ['.codex/AGENTS.md', '.codex/config.toml'],
        },
        paths: expect.objectContaining({
          rulePath: expect.any(Function),
          commandPath: expect.any(Function),
          agentPath: expect.any(Function),
        }),
      }),
    );
  });

  it('returns the Cline global layout metadata', () => {
    const layout = getTargetLayout('cline', 'global');
    expect(layout).toEqual(
      expect.objectContaining({
        skillDir: '.cline/skills',
        managedOutputs: {
          dirs: [
            'Documents/Cline/Rules',
            'Documents/Cline/Workflows',
            'Documents/Cline/Hooks',
            '.cline/skills',
            '.agents/skills',
          ],
          files: ['.cline/cline_mcp_settings.json', '.clineignore'],
        },
        paths: expect.objectContaining({
          rulePath: expect.any(Function),
          commandPath: expect.any(Function),
          agentPath: expect.any(Function),
        }),
        rewriteGeneratedPath: expect.any(Function),
        mirrorGlobalPath: expect.any(Function),
      }),
    );
    expect(
      layout!.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
      }),
    ).toBe('Documents/Cline/Rules/typescript.md');
    expect(layout!.paths.commandPath('commit', {} as never)).toBe(
      'Documents/Cline/Workflows/commit.md',
    );
  });

  it('lists Cline global detection paths', () => {
    expect(getTargetDetectionPaths('cline', 'global')).toEqual([
      'Documents/Cline/Rules',
      'Documents/Cline/Workflows',
      'Documents/Cline/Hooks',
      '.cline/skills',
      '.cline/cline_mcp_settings.json',
      '.clineignore',
    ]);
  });

  it('returns the Continue global layout metadata', () => {
    const layout = getTargetLayout('continue', 'global');
    expect(layout).toEqual(
      expect.objectContaining({
        rootInstructionPath: '.continue/rules/general.md',
        skillDir: '.continue/skills',
        managedOutputs: {
          dirs: ['.continue/rules', '.continue/prompts', '.continue/skills', '.agents/skills'],
          files: ['.continue/mcpServers/agentsmesh.json'],
        },
        paths: expect.objectContaining({
          rulePath: expect.any(Function),
          commandPath: expect.any(Function),
          agentPath: expect.any(Function),
        }),
        mirrorGlobalPath: expect.any(Function),
      }),
    );
    expect(
      layout!.paths.rulePath('typescript', {
        source: 'typescript.md',
        root: false,
        targets: [],
        description: '',
        globs: [],
        body: '',
      }),
    ).toBe('.continue/rules/typescript.md');
    expect(layout!.paths.commandPath('commit', {} as never)).toBe('.continue/prompts/commit.md');
    expect(layout!.paths.agentPath('my-agent', {} as never)).toBeNull();
  });

  it('lists Continue global detection paths', () => {
    expect(getTargetDetectionPaths('continue', 'global')).toEqual([
      '.continue/rules',
      '.continue/prompts',
      '.continue/mcpServers',
      '.continue/skills',
    ]);
  });

  it('returns undefined for unknown targets', () => {
    expect(getTargetLayout('unknown-target')).toBeUndefined();
    expect(getTargetManagedOutputs('unknown-target')).toBeUndefined();
    expect(getTargetPrimaryRootInstructionPath('unknown-target')).toBeUndefined();
  });
});
