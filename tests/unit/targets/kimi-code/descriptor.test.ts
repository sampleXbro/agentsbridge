import { describe, it, expect } from 'vitest';
// Imported before the target module so the builtin catalog finishes evaluating
// first; entering the circular graph from `kimi-code/index.js` leaves its own
// slot in `BUILTIN_TARGETS` undefined (see registry.ts).
import { getTargetCapabilities } from '../../../../src/targets/catalog/builtin-targets.js';
import { descriptor } from '../../../../src/targets/kimi-code/index.js';
import { validateDescriptor } from '../../../../src/targets/catalog/target-descriptor.schema.js';
import { ownerTargetIdForSharedPath } from '../../../../src/targets/catalog/shared-artifact-owner.js';
import { TARGET_IDS } from '../../../../src/targets/catalog/target-ids.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import { makeRule } from './fixtures.js';

function config(overrides?: Partial<ValidatedConfig>): ValidatedConfig {
  return {
    version: 1,
    targets: [...TARGET_IDS],
    features: ['rules', 'commands', 'agents', 'skills', 'mcp', 'hooks', 'ignore', 'permissions'],
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
    ...overrides,
  };
}

describe('kimi-code descriptor', () => {
  it('passes the runtime descriptor schema', () => {
    expect(() => validateDescriptor(descriptor)).not.toThrow();
  });

  it('carries real metadata, with no scaffold markers left', () => {
    expect(descriptor.metadata).toEqual({
      displayName: 'Kimi Code CLI',
      category: 'cli',
      officialUrl: 'https://moonshotai.github.io/kimi-code/en/',
      shortDescription: 'Moonshot AI terminal coding agent',
    });
    expect(JSON.stringify(descriptor.metadata)).not.toContain('TODO');
  });

  it('declares hooks and permissions as global-only', () => {
    expect(getTargetCapabilities('kimi-code', 'project')).toMatchObject({
      rules: { level: 'native' },
      additionalRules: { level: 'embedded' },
      commands: { level: 'embedded' },
      agents: { level: 'native' },
      skills: { level: 'native' },
      mcp: { level: 'native' },
      hooks: { level: 'partial' },
      ignore: { level: 'none' },
      permissions: { level: 'partial' },
    });
    expect(getTargetCapabilities('kimi-code', 'global')).toMatchObject({
      hooks: { level: 'native' },
      permissions: { level: 'native' },
      ignore: { level: 'none' },
    });
  });

  it('is a consumer of AGENTS.md, never an owner', () => {
    expect(descriptor.sharedArtifacts).toEqual({ 'AGENTS.md': 'consumer' });
    expect(ownerTargetIdForSharedPath('AGENTS.md')).not.toBe('kimi-code');
    expect(ownerTargetIdForSharedPath('.agents/skills/x/SKILL.md')).toBe('codex-cli');
  });

  it('keeps the credential-bearing config.toml out of managed outputs', () => {
    const managed = [
      ...descriptor.project.managedOutputs!.files,
      ...descriptor.project.managedOutputs!.dirs,
      ...descriptor.globalSupport!.layout.managedOutputs!.files,
      ...descriptor.globalSupport!.layout.managedOutputs!.dirs,
    ];
    expect(managed).not.toContain('.kimi-code/config.toml');
    // `.kimi-code` itself holds user files (local.toml, a hand-written AGENTS.md).
    expect(managed).not.toContain('.kimi-code');
    expect(descriptor.project.managedOutputs).toEqual({
      dirs: ['.kimi-code/agents', '.kimi-code/skills'],
      files: ['AGENTS.md'],
      // Kimi Code's own MCP config, in the same directory as config.toml.
      coOwnedFiles: ['.kimi-code/mcp.json'],
      // `.kimi-code/AGENTS.md` is never written but IS evicted once the root
      // file is emitted: Kimi Code reads both, so a leftover copy doubles the rules.
      supersededFiles: ['.kimi-code/AGENTS.md'],
    });
    expect(descriptor.globalSupport!.layout.managedOutputs).toEqual({
      dirs: ['.kimi-code/agents', '.kimi-code/skills'],
      files: ['.kimi-code/AGENTS.md'],
      coOwnedFiles: ['.kimi-code/mcp.json'],
    });
  });

  it('never claims a path another target owns for detection', () => {
    const all = [...descriptor.detectionPaths, ...descriptor.globalSupport!.detectionPaths];
    expect(all).not.toContain('.agents/AGENTS.md');
    expect(all).not.toContain('.agents/skills');
    expect(all).not.toContain('.mcp.json');
    expect(descriptor.detectionPaths).toEqual([
      'AGENTS.md',
      '.kimi-code/AGENTS.md',
      '.kimi-code/agents',
      '.kimi-code/skills',
      '.kimi-code/mcp.json',
    ]);
  });
});

describe('kimi-code layouts', () => {
  it('routes every non-root rule to the one instruction file', () => {
    expect(descriptor.project.paths.rulePath('typescript', makeRule())).toBe('AGENTS.md');
    expect(descriptor.globalSupport!.layout.paths.rulePath('typescript', makeRule())).toBe(
      '.kimi-code/AGENTS.md',
    );
  });

  it('writes agents natively and commands as skills', () => {
    expect(descriptor.project.paths.agentPath('code-reviewer', config())).toBe(
      '.kimi-code/agents/code-reviewer.md',
    );
    expect(descriptor.project.paths.commandPath('review', config())).toBe(
      '.kimi-code/skills/am-command-review/SKILL.md',
    );
    expect(descriptor.globalSupport!.layout.paths.agentPath('researcher', config())).toBe(
      '.kimi-code/agents/researcher.md',
    );
    expect(descriptor.globalSupport!.layout.paths.commandPath('review', config())).toBe(
      '.kimi-code/skills/am-command-review/SKILL.md',
    );
  });

  it('suppresses command output when the user turns the conversion off', () => {
    const off = config({ conversions: { commands_to_skills: { 'kimi-code': false } } });
    expect(descriptor.project.paths.commandPath('review', off)).toBeNull();
    expect(descriptor.globalSupport!.layout.paths.commandPath('review', off)).toBeNull();
  });

  it('rebases only the instruction file for global scope', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite('AGENTS.md')).toBe('.kimi-code/AGENTS.md');
    expect(rewrite('.kimi-code/mcp.json')).toBe('.kimi-code/mcp.json');
    expect(rewrite('.kimi-code/agents/researcher.md')).toBe('.kimi-code/agents/researcher.md');
  });
});
