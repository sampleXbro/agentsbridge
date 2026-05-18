import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
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
  projectRoot = mkdtempSync(join(tmpdir(), 'descriptor-import-lenient-'));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('descriptor-import-runner lenient parsing', () => {
  it('skips files with invalid frontmatter in singleFile fallback (no custom mapper)', async () => {
    writeFile(
      '.test/AGENTS.md',
      '---\ndescription: Fix tool -- repairs things\nargument-hint: [a] [b]\n---\n\nBody\n',
    );

    const descriptor = descriptorWith({
      importer: {
        rules: {
          feature: 'rules',
          mode: 'singleFile',
          source: { project: ['.test/AGENTS.md'] },
          canonicalDir: '.agentsmesh/rules',
          canonicalRootFilename: '_root.md',
          markAsRoot: true,
        },
      },
    });

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const results = await runDescriptorImport(descriptor, projectRoot, 'project', {
      normalize: (c) => c,
    });
    stderrSpy.mockRestore();

    expect(results).toEqual([]);
  });

  it('skips files with invalid frontmatter when custom mapper throws', async () => {
    writeFile('.test/AGENTS.md', '---\ndescription: ok\n---\nbody\n');

    const descriptor = descriptorWith({
      importer: {
        rules: {
          feature: 'rules',
          mode: 'singleFile',
          source: { project: ['.test/AGENTS.md'] },
          canonicalDir: '.agentsmesh/rules',
          canonicalRootFilename: '_root.md',
          map: async () => {
            throw new Error('YAML parse failure from mapper');
          },
        },
      },
    });

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const results = await runDescriptorImport(descriptor, projectRoot, 'project', {
      normalize: (c) => c,
    });
    stderrSpy.mockRestore();

    expect(results).toEqual([]);
  });

  it('skips broken files in directory mode while keeping good ones', async () => {
    writeFile('.test/rules/good.md', '---\ndescription: Good rule\n---\n\nGood body\n');
    writeFile(
      '.test/rules/broken.md',
      '---\ndescription: Broken -- tool\nargument-hint: [a] [b]\n---\n\nBroken body\n',
    );

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

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const results = await runDescriptorImport(descriptor, projectRoot, 'project', {
      normalize: (c) => c,
    });
    stderrSpy.mockRestore();

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.fromPath.includes('broken.md'))).toBe(false);
    expect(results.some((r) => r.fromPath.includes('good.md'))).toBe(true);
  });
});
