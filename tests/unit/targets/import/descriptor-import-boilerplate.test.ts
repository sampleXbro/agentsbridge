/**
 * Native descriptor import must skip repo-boilerplate files (README, LICENSE,
 * CONTRIBUTING, ...) when discovering canonical entities. Otherwise a third-party
 * `.claude/agents/README.md` (folder documentation) materializes as a canonical
 * agent and collides with any other `README.md` further down the tree at parse
 * time. Regression for `qdhenry/Claude-Command-Suite` (two README.md files under
 * `.claude/agents/`, both nominal documentation).
 */

import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDescriptorImport } from '../../../../src/targets/import/descriptor-import-runner.js';
import type { TargetDescriptor } from '../../../../src/targets/catalog/target-descriptor.js';

let projectRoot: string;

function writeFile(rel: string, content: string): void {
  const abs = join(projectRoot, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, content);
}

function descriptorWith(overrides: Partial<TargetDescriptor>): TargetDescriptor {
  return {
    id: 'test-target',
    generators: { name: 'test-target', generateRules: () => [], importFrom: async () => [] },
    capabilities: {
      rules: 'native',
      additionalRules: 'none',
      commands: 'none',
      agents: 'native',
      skills: 'none',
      mcp: 'none',
      hooks: 'none',
      ignore: 'none',
      permissions: 'none',
    },
    emptyImportMessage: '',
    lintRules: null,
    project: {
      paths: { rulePath: (s: string) => s, commandPath: () => null, agentPath: () => null },
    },
    buildImportPaths: async () => {},
    detectionPaths: [],
    ...overrides,
  } as unknown as TargetDescriptor;
}

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'descriptor-boilerplate-'));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('runDescriptorImport — directory mode skips repo boilerplate', () => {
  it('skips README.md at multiple depths so they do not collide on slug', async () => {
    writeFile('.test/agents/README.md', '---\n---\nfolder docs\n');
    writeFile('.test/agents/external/README.md', '---\n---\nexternal folder docs\n');
    writeFile('.test/agents/real-agent.md', '---\ndescription: D\n---\nbody\n');
    const descriptor = descriptorWith({
      importer: {
        agents: {
          feature: 'agents',
          mode: 'directory',
          source: { project: ['.test/agents'] },
          canonicalDir: '.agentsmesh/agents',
          extensions: ['.md'],
          preset: 'agent',
        },
      },
    });

    const results = await runDescriptorImport(descriptor, projectRoot, 'project', {
      normalize: (c) => c,
    });

    expect(results.map((r) => r.toPath).sort()).toEqual(['.agentsmesh/agents/real-agent.md']);
    expect(existsSync(join(projectRoot, '.agentsmesh/agents/README.md'))).toBe(false);
    expect(existsSync(join(projectRoot, '.agentsmesh/agents/external/README.md'))).toBe(false);
    expect(existsSync(join(projectRoot, '.agentsmesh/agents/real-agent.md'))).toBe(true);
  });

  it('skips LICENSE / NOTICE / COPYING alongside canonical entity files', async () => {
    writeFile('.test/commands/LICENSE.md', 'license text');
    writeFile('.test/commands/NOTICE.md', 'notice text');
    writeFile('.test/commands/COPYING.md', 'copying text');
    writeFile('.test/commands/run.md', '---\ndescription: Run\n---\nbody\n');
    const descriptor = descriptorWith({
      importer: {
        commands: {
          feature: 'commands',
          mode: 'directory',
          source: { project: ['.test/commands'] },
          canonicalDir: '.agentsmesh/commands',
          extensions: ['.md'],
          preset: 'command',
        },
      },
    });

    const results = await runDescriptorImport(descriptor, projectRoot, 'project', {
      normalize: (c) => c,
    });

    expect(results.map((r) => r.toPath).sort()).toEqual(['.agentsmesh/commands/run.md']);
    expect(existsSync(join(projectRoot, '.agentsmesh/commands/LICENSE.md'))).toBe(false);
    expect(existsSync(join(projectRoot, '.agentsmesh/commands/NOTICE.md'))).toBe(false);
    expect(existsSync(join(projectRoot, '.agentsmesh/commands/COPYING.md'))).toBe(false);
  });

  it('keeps noise-named files like security.md so users may name rules security', async () => {
    // SECURITY.md is conventionally a repo-housekeeping file, but a user
    // who deliberately writes `.claude/rules/security.md` means it as a rule.
    // The native-import filter is the preserved-only subset to avoid this
    // false positive; integration coverage lives in extends-native.
    writeFile('.test/rules/security.md', '---\ndescription: Security\n---\nrule body\n');
    const descriptor = descriptorWith({
      importer: {
        rules: {
          feature: 'rules',
          mode: 'directory',
          source: { project: ['.test/rules'] },
          canonicalDir: '.agentsmesh/rules',
          extensions: ['.md'],
          preset: 'rule',
        },
      },
    });

    const results = await runDescriptorImport(descriptor, projectRoot, 'project', {
      normalize: (c) => c,
    });

    expect(results.map((r) => r.toPath)).toEqual(['.agentsmesh/rules/security.md']);
  });
});
