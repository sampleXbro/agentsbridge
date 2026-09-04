import { describe, it, expect } from 'vitest';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalRule } from '../../../../src/core/types.js';
import { descriptor } from '../../../../src/targets/openhands/index.js';

const config = {} as ValidatedConfig;

function makeRule(slug: string): CanonicalRule {
  return {
    source: `.agentsmesh/rules/${slug}.md`,
    root: false,
    targets: [],
    description: '',
    globs: [],
    body: '',
  };
}

describe('openhands descriptor metadata', () => {
  it('carries the published metadata with no scaffold placeholders', () => {
    expect(descriptor.metadata).toEqual({
      displayName: 'OpenHands',
      category: 'cli',
      officialUrl: 'https://docs.openhands.dev',
      shortDescription: 'Open-source autonomous coding agent (self-hosted)',
    });
  });

  it('consumes the shared .agents artifact prefixes instead of claiming them', () => {
    expect(descriptor.sharedArtifacts).toEqual({
      '.agents/skills/': 'consumer',
      '.agents/agents/': 'consumer',
      '.agents/plugins/': 'consumer',
    });
  });

  it('declares the same capability levels in both scopes', () => {
    expect(descriptor.capabilities).toEqual({
      rules: 'native',
      additionalRules: 'native',
      commands: 'native',
      agents: 'native',
      skills: 'native',
      mcp: 'native',
      hooks: 'native',
      ignore: 'none',
      permissions: 'partial',
    });
    expect(descriptor.globalSupport!.capabilities).toEqual(descriptor.capabilities);
  });
});

describe('openhands project layout', () => {
  const project = descriptor.project;

  it('roots instructions at AGENTS.md and skills at the shared .agents/skills', () => {
    expect(project.rootInstructionPath).toBe('AGENTS.md');
    expect(project.skillDir).toBe('.agents/skills');
  });

  it('resolves rule, command and agent paths', () => {
    expect(project.paths.rulePath('typescript', makeRule('typescript'))).toBe(
      '.agents/skills/typescript.md',
    );
    expect(project.paths.commandPath('review', config)).toBe(
      '.agents/plugins/agentsmesh/commands/review.md',
    );
    expect(project.paths.agentPath('code-reviewer', config)).toBe(
      '.agents/agents/code-reviewer.md',
    );
  });

  it('manages only directories it fills itself, never the whole plugin dir', () => {
    expect(project.managedOutputs).toEqual({
      dirs: ['.agents/agents', '.agents/skills', '.agents/plugins/agentsmesh/commands'],
      files: ['AGENTS.md', '.agents/plugins/agentsmesh/.mcp.json'],
      // The user's own OpenHands config file: co-owned, never stale-deleted.
      coOwnedFiles: ['.openhands/hooks.json'],
    });
    // goose owns `.agents/plugins/agentsmesh/hooks/hooks.json`; managing the plugin
    // directory would delete it on every openhands-only run.
    expect(project.managedOutputs!.dirs).not.toContain('.agents/plugins/agentsmesh');
    expect(project.managedOutputs!.dirs).not.toContain('.agents/plugins');
  });
});

describe('openhands global layout', () => {
  const global = descriptor.globalSupport!.layout;

  it('moves the root rule into the always-injected global skill file', () => {
    expect(global.rootInstructionPath).toBe('.agents/skills/_root.md');
    expect(global.rewriteGeneratedPath!('AGENTS.md')).toBe('.agents/skills/_root.md');
  });

  it('keeps every other path identical because ~/.agents and ~/.openhands mirror the project tree', () => {
    for (const path of [
      '.agents/skills/typescript.md',
      '.agents/agents/code-reviewer.md',
      '.agents/plugins/agentsmesh/commands/review.md',
      '.agents/plugins/agentsmesh/.mcp.json',
      '.openhands/hooks.json',
    ]) {
      expect(global.rewriteGeneratedPath!(path)).toBe(path);
    }
  });

  it('resolves the same rule, command and agent paths as the project scope', () => {
    expect(global.paths.rulePath('typescript', makeRule('typescript'))).toBe(
      '.agents/skills/typescript.md',
    );
    expect(global.paths.commandPath('review', config)).toBe(
      '.agents/plugins/agentsmesh/commands/review.md',
    );
    expect(global.paths.agentPath('code-reviewer', config)).toBe('.agents/agents/code-reviewer.md');
  });

  it('manages the global root file instead of AGENTS.md', () => {
    expect(global.managedOutputs).toEqual({
      dirs: ['.agents/agents', '.agents/skills', '.agents/plugins/agentsmesh/commands'],
      files: ['.agents/skills/_root.md', '.agents/plugins/agentsmesh/.mcp.json'],
      // The user's own OpenHands config file: co-owned, never stale-deleted.
      coOwnedFiles: ['.openhands/hooks.json'],
    });
  });

  it('detects on the .openhands tree only, never on the shared .agents tree', () => {
    expect(descriptor.detectionPaths).toEqual([
      '.openhands',
      '.openhands/hooks.json',
      '.agents/plugins/agentsmesh/commands',
    ]);
    expect(descriptor.globalSupport!.detectionPaths).toEqual([
      '.openhands',
      '.openhands/hooks.json',
    ]);
  });
});
