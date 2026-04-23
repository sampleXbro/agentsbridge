import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ruleTargetPath,
  commandTargetPath,
  agentTargetPath,
} from '../../../src/core/reference/map-targets.js';
import { buildImportReferenceMap } from '../../../src/core/reference/import-map.js';
import { TARGET_IDS } from '../../../src/targets/catalog/target-ids.js';
import type { ValidatedConfig } from '../../../src/config/core/schema.js';
import type { CanonicalRule } from '../../../src/core/types.js';

function baseConfig(): ValidatedConfig {
  return {
    version: 1,
    targets: [...TARGET_IDS],
    features: ['rules', 'commands', 'agents', 'skills', 'mcp', 'hooks', 'ignore', 'permissions'],
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
  };
}

function makeRule(slug: string, overrides?: Partial<CanonicalRule>): CanonicalRule {
  return {
    source: `${slug}.md`,
    body: `# ${slug}`,
    root: false,
    targets: [],
    globs: [],
    description: '',
    ...overrides,
  };
}

describe('ruleTargetPath', () => {
  it('returns null for unknown target', () => {
    const rule = makeRule('example');
    expect(ruleTargetPath('unknown-target', rule)).toBeNull();
  });

  it('returns primaryRootInstructionPath for root rule on claude-code', () => {
    const rule = makeRule('_root', { root: true });
    expect(ruleTargetPath('claude-code', rule)).toBe('.claude/CLAUDE.md');
  });

  it('returns null when rule targets exclude the given target', () => {
    const rule = makeRule('example', { targets: ['cursor'] });
    expect(ruleTargetPath('claude-code', rule)).toBeNull();
  });

  it('delegates to descriptor.paths.rulePath for a normal rule on claude-code', () => {
    const rule = makeRule('example');
    expect(ruleTargetPath('claude-code', rule)).toBe('.claude/rules/example.md');
  });

  it('returns null when the requested scope layout is missing', () => {
    const rule = makeRule('example');
    expect(ruleTargetPath('claude-code', rule, 'global')).toBe('.claude/rules/example.md');
  });
});

describe('commandTargetPath', () => {
  it('returns null for unknown target', () => {
    expect(commandTargetPath('unknown-target', 'deploy', baseConfig())).toBeNull();
  });

  it('delegates to descriptor for cursor target', () => {
    expect(commandTargetPath('cursor', 'deploy', baseConfig())).toBe('.cursor/commands/deploy.md');
  });
});

describe('agentTargetPath', () => {
  it('returns null for unknown target', () => {
    expect(agentTargetPath('unknown-target', 'reviewer', baseConfig())).toBeNull();
  });

  it('returns null for continue target which has no agent support', () => {
    expect(agentTargetPath('continue', 'reviewer', baseConfig())).toBeNull();
  });

  it('delegates to descriptor for claude-code target', () => {
    expect(agentTargetPath('claude-code', 'reviewer', baseConfig())).toBe(
      '.claude/agents/reviewer.md',
    );
  });

  it('delegates to the Claude global descriptor layout when requested', () => {
    expect(agentTargetPath('claude-code', 'reviewer', baseConfig(), 'global')).toBe(
      '.claude/agents/reviewer.md',
    );
  });
});

describe('buildImportReferenceMap', () => {
  it('returns empty map for unknown target', async () => {
    const refs = await buildImportReferenceMap('unknown-target', '/tmp');
    expect(refs.size).toBe(0);
  });

  it('returns static root instruction mappings for claude-code without files on disk', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'agentsmesh-test-'));
    const refs = await buildImportReferenceMap('claude-code', tempDir);
    expect(refs.get('.claude/CLAUDE.md')).toBe('.agentsmesh/rules/_root.md');
    expect(refs.get('CLAUDE.md')).toBe('.agentsmesh/rules/_root.md');
  });
});
