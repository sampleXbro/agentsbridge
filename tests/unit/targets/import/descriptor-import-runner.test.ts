/**
 * Descriptor-driven importer runner contract tests.
 *
 * Synthetic temp project + minimal descriptor — exercises every mode
 * (singleFile / directory / flatFile / mcpJson) and asserts that scope
 * variance with no `global` source silently skips the feature (Gap #3).
 */

import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
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

function read(rel: string): string {
  return readFileSync(join(projectRoot, rel), 'utf-8');
}

function descriptorWith(overrides: Partial<TargetDescriptor>): TargetDescriptor {
  return {
    id: 'test-target',
    generators: { name: 'test-target', generateRules: () => [], importFrom: async () => [] },
    capabilities: {
      rules: 'native',
      additionalRules: 'none',
      commands: 'none',
      agents: 'none',
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
  projectRoot = mkdtempSync(join(tmpdir(), 'descriptor-import-runner-'));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('runDescriptorImport — singleFile mode', () => {
  it('imports the first existing source file in the fallback chain', async () => {
    writeFile('.test/AGENTS.md', '# title\n');
    const descriptor = descriptorWith({
      importer: {
        rules: {
          feature: 'rules',
          mode: 'singleFile',
          source: { project: ['MISSING.md', '.test/AGENTS.md'] },
          canonicalDir: '.agentsmesh/rules',
          canonicalRootFilename: '_root.md',
          markAsRoot: true,
        },
      },
    });

    const results = await runDescriptorImport(descriptor, projectRoot, 'project', {
      normalize: (c) => c,
    });

    expect(results).toEqual([
      {
        fromTool: 'test-target',
        fromPath: join(projectRoot, '.test/AGENTS.md'),
        toPath: '.agentsmesh/rules/_root.md',
        feature: 'rules',
      },
    ]);
    expect(read('.agentsmesh/rules/_root.md')).toContain('root: true');
    expect(read('.agentsmesh/rules/_root.md')).toContain('# title');
  });

  it('honors a custom map callback in singleFile mode', async () => {
    writeFile('.test/AGENTS.md', '---\ndescription: D\nextra: drop-me\n---\nbody\n');
    const descriptor = descriptorWith({
      importer: {
        rules: {
          feature: 'rules',
          mode: 'singleFile',
          source: { project: ['.test/AGENTS.md'] },
          canonicalDir: '.agentsmesh/rules',
          canonicalRootFilename: '_root.md',
          map: async ({ destDir, normalizeTo }) => {
            const destPath = join(destDir, '_root.md');
            return {
              destPath,
              toPath: '.agentsmesh/rules/_root.md',
              content: `--- override ${normalizeTo(destPath).length}`,
            };
          },
        },
      },
    });
    const results = await runDescriptorImport(descriptor, projectRoot, 'project', {
      normalize: (c) => c,
    });
    expect(results).toHaveLength(1);
    expect(read('.agentsmesh/rules/_root.md').startsWith('--- override ')).toBe(true);
  });

  it('honors frontmatterRemap in singleFile mode', async () => {
    writeFile('.test/AGENTS.md', '---\ndescription: D\nextra: drop\n---\nbody\n');
    const descriptor = descriptorWith({
      importer: {
        rules: {
          feature: 'rules',
          mode: 'singleFile',
          source: { project: ['.test/AGENTS.md'] },
          canonicalDir: '.agentsmesh/rules',
          canonicalRootFilename: '_root.md',
          markAsRoot: true,
          // Drop the `extra` key so it doesn't leak into canonical frontmatter.
          frontmatterRemap: ({ description }) => ({ description }),
        },
      },
    });
    await runDescriptorImport(descriptor, projectRoot, 'project', { normalize: (c) => c });
    const written = read('.agentsmesh/rules/_root.md');
    expect(written).toContain('root: true');
    expect(written).toContain('description: D');
    expect(written).not.toContain('extra:');
  });

  it('returns no results when no source exists', async () => {
    const descriptor = descriptorWith({
      importer: {
        rules: {
          feature: 'rules',
          mode: 'singleFile',
          source: { project: ['MISSING.md'] },
          canonicalDir: '.agentsmesh/rules',
          canonicalRootFilename: '_root.md',
        },
      },
    });
    expect(
      await runDescriptorImport(descriptor, projectRoot, 'project', { normalize: (c) => c }),
    ).toEqual([]);
  });
});

describe('runDescriptorImport — directory mode with built-in mappers', () => {
  it('rule preset writes canonical rules with root: false', async () => {
    writeFile('.test/rules/foo.md', '---\ndescription: Foo\n---\n\n# foo body\n');
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
    expect(results).toHaveLength(1);
    expect(results[0]?.toPath).toBe('.agentsmesh/rules/foo.md');
    const written = read('.agentsmesh/rules/foo.md');
    expect(written).toContain('description: Foo');
    expect(written).toContain('# foo body');
  });

  it('command preset projects description and allowed-tools', async () => {
    writeFile(
      '.test/commands/run.md',
      '---\ndescription: Run x\nallowed-tools: [Read, Edit]\n---\nbody\n',
    );
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
    const [result] = await runDescriptorImport(descriptor, projectRoot, 'project', {
      normalize: (c) => c,
    });
    expect(result?.toPath).toBe('.agentsmesh/commands/run.md');
    const written = read('.agentsmesh/commands/run.md');
    expect(written).toContain('Run x');
    expect(written).toContain('Read');
  });

  it('frontmatterRemap rewrites source-specific fields before serialization', async () => {
    writeFile('.test/rules/scoped.md', '---\napplyTo: src/**\n---\nbody\n');
    const descriptor = descriptorWith({
      importer: {
        rules: {
          feature: 'rules',
          mode: 'directory',
          source: { project: ['.test/rules'] },
          canonicalDir: '.agentsmesh/rules',
          extensions: ['.md'],
          preset: 'rule',
          frontmatterRemap: (fm) => ({ ...fm, globs: [String(fm.applyTo)] }),
        },
      },
    });
    const [result] = await runDescriptorImport(descriptor, projectRoot, 'project', {
      normalize: (c) => c,
    });
    expect(result).toBeDefined();
    expect(read('.agentsmesh/rules/scoped.md')).toContain('- src/**');
  });

  it('directory spec without preset or map throws a clear error', async () => {
    writeFile('.test/rules/oops.md', 'body');
    const descriptor = descriptorWith({
      importer: {
        rules: {
          feature: 'rules',
          mode: 'directory',
          source: { project: ['.test/rules'] },
          canonicalDir: '.agentsmesh/rules',
          extensions: ['.md'],
        },
      },
    });
    await expect(
      runDescriptorImport(descriptor, projectRoot, 'project', { normalize: (c) => c }),
    ).rejects.toThrow(/needs a `preset` or `map`/);
  });
});

describe('runDescriptorImport — flatFile mode', () => {
  it('copies an ignore file verbatim with trimmed trailing whitespace', async () => {
    writeFile('.testignore', 'node_modules\n.cache\n\n\n');
    const descriptor = descriptorWith({
      importer: {
        ignore: {
          feature: 'ignore',
          mode: 'flatFile',
          source: { project: ['.testignore'] },
          canonicalDir: '.agentsmesh',
          canonicalFilename: '.agentsmesh/ignore',
        },
      },
    });
    const results = await runDescriptorImport(descriptor, projectRoot, 'project', {
      normalize: (c) => c,
    });
    expect(results).toEqual([
      {
        fromTool: 'test-target',
        fromPath: join(projectRoot, '.testignore'),
        toPath: '.agentsmesh/ignore',
        feature: 'ignore',
      },
    ]);
    expect(read('.agentsmesh/ignore')).toBe('node_modules\n.cache');
  });
});

describe('runDescriptorImport — mcpJson mode', () => {
  it('parses stdio + http servers and writes canonical mcp.json', async () => {
    writeFile(
      '.test/mcp.json',
      JSON.stringify({
        mcpServers: {
          local: { command: 'node', args: ['server.js'] },
          remote: { url: 'https://example.com/mcp' },
          ignored: { foo: 'bar' },
        },
      }),
    );
    const descriptor = descriptorWith({
      importer: {
        mcp: {
          feature: 'mcp',
          mode: 'mcpJson',
          source: { project: ['.test/mcp.json'] },
          canonicalDir: '.agentsmesh',
          canonicalFilename: '.agentsmesh/mcp.json',
        },
      },
    });
    const results = await runDescriptorImport(descriptor, projectRoot, 'project', {
      normalize: (c) => c,
    });
    expect(results).toHaveLength(1);
    const written = JSON.parse(read('.agentsmesh/mcp.json')) as {
      mcpServers: Record<string, { type: string }>;
    };
    expect(Object.keys(written.mcpServers).sort()).toEqual(['local', 'remote']);
    expect(written.mcpServers.local!.type).toBe('stdio');
    expect(written.mcpServers.remote!.type).toBe('http');
  });

  it('writes nothing when the JSON has no valid servers', async () => {
    writeFile('.test/mcp.json', '{}');
    const descriptor = descriptorWith({
      importer: {
        mcp: {
          feature: 'mcp',
          mode: 'mcpJson',
          source: { project: ['.test/mcp.json'] },
          canonicalDir: '.agentsmesh',
          canonicalFilename: '.agentsmesh/mcp.json',
        },
      },
    });
    expect(
      await runDescriptorImport(descriptor, projectRoot, 'project', { normalize: (c) => c }),
    ).toEqual([]);
    expect(existsSync(join(projectRoot, '.agentsmesh/mcp.json'))).toBe(false);
  });
});

describe('runDescriptorImport — scope variance (Gap #3 absorption)', () => {
  it('skips features whose source omits the active scope', async () => {
    writeFile('.test/AGENTS.md', '# present\n');
    writeFile('.test/hooks.json', '{}');
    const descriptor = descriptorWith({
      importer: {
        rules: {
          feature: 'rules',
          mode: 'singleFile',
          source: { project: ['.test/AGENTS.md'], global: ['.test/AGENTS.md'] },
          canonicalDir: '.agentsmesh/rules',
          canonicalRootFilename: '_root.md',
          markAsRoot: true,
        },
        hooks: {
          // No `global` source — runner must skip this in global mode without
          // the importer body needing an `if (scope === 'global')` branch.
          feature: 'hooks',
          mode: 'flatFile',
          source: { project: ['.test/hooks.json'] },
          canonicalDir: '.agentsmesh',
          canonicalFilename: '.agentsmesh/hooks.json',
        },
      },
    });

    const projectResults = await runDescriptorImport(descriptor, projectRoot, 'project', {
      normalize: (c) => c,
    });
    expect(projectResults.map((r) => r.feature).sort()).toEqual(['hooks', 'rules']);

    const globalResults = await runDescriptorImport(descriptor, projectRoot, 'global', {
      normalize: (c) => c,
    });
    expect(globalResults.map((r) => r.feature)).toEqual(['rules']);
  });

  it('returns nothing when the descriptor has no importer block', async () => {
    const descriptor = descriptorWith({});
    expect(
      await runDescriptorImport(descriptor, projectRoot, 'project', { normalize: (c) => c }),
    ).toEqual([]);
  });

  it('processes multiple specs for the same feature in declaration order', async () => {
    writeFile('.test/legacy/old.md', '---\n---\nbody\n');
    writeFile('.test/new/fresh.md', '---\n---\nbody\n');
    const descriptor = descriptorWith({
      importer: {
        rules: [
          {
            feature: 'rules',
            mode: 'directory',
            source: { project: ['.test/legacy'] },
            canonicalDir: '.agentsmesh/rules/legacy',
            extensions: ['.md'],
            preset: 'rule',
          },
          {
            feature: 'rules',
            mode: 'directory',
            source: { project: ['.test/new'] },
            canonicalDir: '.agentsmesh/rules/fresh',
            extensions: ['.md'],
            preset: 'rule',
          },
        ],
      },
    });
    const results = await runDescriptorImport(descriptor, projectRoot, 'project', {
      normalize: (c) => c,
    });
    expect(results.map((r) => r.toPath).sort()).toEqual([
      '.agentsmesh/rules/fresh/fresh.md',
      '.agentsmesh/rules/legacy/old.md',
    ]);
  });
});
