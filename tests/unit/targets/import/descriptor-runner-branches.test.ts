import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runDescriptorImport } from '../../../../src/targets/import/descriptor-import-runner.js';
import type { TargetDescriptor } from '../../../../src/targets/catalog/target-descriptor.js';

function descriptorWith(overrides: Partial<TargetDescriptor>): TargetDescriptor {
  return {
    id: 'cov-target',
    generators: { name: 'cov-target', generateRules: () => [], importFrom: async () => [] },
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

let projectRoot: string;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'amesh-cov-desc-'));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

function writeFile(rel: string, content: string): void {
  const abs = join(projectRoot, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, content);
}

describe('runDescriptorImport — additional branch coverage', () => {
  it('throws when singleFile has no canonicalRootFilename', async () => {
    writeFile('.t/AGENTS.md', '# r\n');
    const desc = descriptorWith({
      importer: {
        rules: {
          feature: 'rules',
          mode: 'singleFile',
          source: { project: ['.t/AGENTS.md'] },
          canonicalDir: '.agentsmesh/rules',
        },
      },
    });
    await expect(
      runDescriptorImport(desc, projectRoot, 'project', { normalize: (c) => c }),
    ).rejects.toThrow(/singleFile spec for rules must set canonicalRootFilename/);
  });

  it('throws when flatFile has no canonicalFilename', async () => {
    writeFile('.t/.ignore', 'foo');
    const desc = descriptorWith({
      importer: {
        ignore: {
          feature: 'ignore',
          mode: 'flatFile',
          source: { project: ['.t/.ignore'] },
          canonicalDir: '.agentsmesh',
        },
      },
    });
    await expect(
      runDescriptorImport(desc, projectRoot, 'project', { normalize: (c) => c }),
    ).rejects.toThrow(/flatFile spec for ignore must set canonicalFilename/);
  });

  it('throws when mcpJson has no canonicalFilename', async () => {
    writeFile('.t/mcp.json', '{}');
    const desc = descriptorWith({
      importer: {
        mcp: {
          feature: 'mcp',
          mode: 'mcpJson',
          source: { project: ['.t/mcp.json'] },
          canonicalDir: '.agentsmesh',
        },
      },
    });
    await expect(
      runDescriptorImport(desc, projectRoot, 'project', { normalize: (c) => c }),
    ).rejects.toThrow(/mcpJson spec for mcp must set canonicalFilename/);
  });

  it('skips singleFile sources whose files do not exist', async () => {
    const desc = descriptorWith({
      importer: {
        rules: {
          feature: 'rules',
          mode: 'singleFile',
          source: { project: ['no-such-1.md', 'no-such-2.md'] },
          canonicalDir: '.agentsmesh/rules',
          canonicalRootFilename: '_root.md',
        },
      },
    });
    const out = await runDescriptorImport(desc, projectRoot, 'project', { normalize: (c) => c });
    expect(out).toEqual([]);
    expect(existsSync(join(projectRoot, '.agentsmesh/rules/_root.md'))).toBe(false);
  });

  it('skips singleFile when map returns null (drops the file)', async () => {
    writeFile('.t/AGENTS.md', '---\n---\nbody');
    const desc = descriptorWith({
      importer: {
        rules: {
          feature: 'rules',
          mode: 'singleFile',
          source: { project: ['.t/AGENTS.md'] },
          canonicalDir: '.agentsmesh/rules',
          canonicalRootFilename: '_root.md',
          map: async () => null,
        },
      },
    });
    const out = await runDescriptorImport(desc, projectRoot, 'project', { normalize: (c) => c });
    expect(out).toEqual([]);
  });

  it('mcpJson skips invalid JSON content', async () => {
    writeFile('.t/mcp.json', '{not json');
    const desc = descriptorWith({
      importer: {
        mcp: {
          feature: 'mcp',
          mode: 'mcpJson',
          source: { project: ['.t/mcp.json'] },
          canonicalDir: '.agentsmesh',
          canonicalFilename: '.agentsmesh/mcp.json',
        },
      },
    });
    const out = await runDescriptorImport(desc, projectRoot, 'project', { normalize: (c) => c });
    expect(out).toEqual([]);
  });

  it('mcpJson skips when parsed JSON is not an object (array root)', async () => {
    writeFile('.t/mcp.json', '[]');
    const desc = descriptorWith({
      importer: {
        mcp: {
          feature: 'mcp',
          mode: 'mcpJson',
          source: { project: ['.t/mcp.json'] },
          canonicalDir: '.agentsmesh',
          canonicalFilename: '.agentsmesh/mcp.json',
        },
      },
    });
    const out = await runDescriptorImport(desc, projectRoot, 'project', { normalize: (c) => c });
    expect(out).toEqual([]);
  });

  it('mcpJson skips when mcpServers is array', async () => {
    writeFile('.t/mcp.json', '{"mcpServers": []}');
    const desc = descriptorWith({
      importer: {
        mcp: {
          feature: 'mcp',
          mode: 'mcpJson',
          source: { project: ['.t/mcp.json'] },
          canonicalDir: '.agentsmesh',
          canonicalFilename: '.agentsmesh/mcp.json',
        },
      },
    });
    const out = await runDescriptorImport(desc, projectRoot, 'project', { normalize: (c) => c });
    expect(out).toEqual([]);
  });

  it('mcpJson uses default normalize when options.normalize omitted', async () => {
    writeFile('.t/mcp.json', JSON.stringify({ mcpServers: { srv: { command: 'node' } } }));
    const desc = descriptorWith({
      importer: {
        mcp: {
          feature: 'mcp',
          mode: 'mcpJson',
          source: { project: ['.t/mcp.json'] },
          canonicalDir: '.agentsmesh',
          canonicalFilename: '.agentsmesh/mcp.json',
        },
      },
    });
    // No options.normalize provided — runner constructs one via the descriptor.
    const out = await runDescriptorImport(desc, projectRoot, 'project');
    expect(out).toHaveLength(1);
  });

  it('falls back to fallbacks when source has no paths for the active scope', async () => {
    writeFile('.t/fb.md', '# fallback content\n');
    const desc = descriptorWith({
      importer: {
        rules: {
          feature: 'rules',
          mode: 'singleFile',
          // Only `global` is provided in source; falls through for project scope.
          source: { global: ['nope.md'] },
          fallbacks: { project: ['.t/fb.md'] },
          canonicalDir: '.agentsmesh/rules',
          canonicalRootFilename: '_root.md',
          markAsRoot: true,
        },
      },
    });
    const out = await runDescriptorImport(desc, projectRoot, 'project', { normalize: (c) => c });
    expect(out).toHaveLength(1);
    expect(readFileSync(join(projectRoot, '.agentsmesh/rules/_root.md'), 'utf-8')).toContain(
      'fallback content',
    );
  });

  it('parseMcpJson handles url-only http server', async () => {
    writeFile(
      '.t/mcp.json',
      JSON.stringify({
        mcpServers: {
          remote: { url: 'https://example.com/mcp' },
          ignored: { foo: 'bar' },
          arr: [],
        },
      }),
    );
    const desc = descriptorWith({
      importer: {
        mcp: {
          feature: 'mcp',
          mode: 'mcpJson',
          source: { project: ['.t/mcp.json'] },
          canonicalDir: '.agentsmesh',
          canonicalFilename: '.agentsmesh/mcp.json',
        },
      },
    });
    const out = await runDescriptorImport(desc, projectRoot, 'project', { normalize: (c) => c });
    expect(out).toHaveLength(1);
    const written = JSON.parse(
      readFileSync(join(projectRoot, '.agentsmesh/mcp.json'), 'utf-8'),
    ) as { mcpServers: Record<string, { type: string }> };
    expect(written.mcpServers.remote!.type).toBe('http');
  });
});
