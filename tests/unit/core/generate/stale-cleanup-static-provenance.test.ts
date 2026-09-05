/**
 * Static managed files (CLAUDE.md, .claudeignore, AGENTS.md, ...) need the same
 * provenance gate as directory sweeps: agentsmesh may only evict what it wrote.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { findStaleGeneratedOutputs } from '../../../../src/core/generate/stale-cleanup.js';
import { getTargetManagedOutputs } from '../../../../src/targets/catalog/builtin-targets.js';
import {
  registerTargetDescriptor,
  resetRegistry,
} from '../../../../src/targets/catalog/registry.js';
import type { TargetDescriptor } from '../../../../src/targets/catalog/target-descriptor.js';

let root: string;
const staticFile = (): string => {
  const file = getTargetManagedOutputs('claude-code', 'project')?.files[0];
  if (file === undefined) throw new Error('claude-code declares no static managed file');
  return file;
};

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'am-'));
  const abs = join(root, staticFile());
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, 'hand-written by the user\n', 'utf-8');
});

afterEach(async () => {
  resetRegistry();
  await rm(root, { recursive: true, force: true });
});

const PLUGIN: TargetDescriptor = {
  id: 'plug',
  metadata: {
    displayName: 'plug',
    category: 'cli',
    officialUrl: 'https://example.test/plug',
    shortDescription: 'x',
  },
  generators: {
    name: 'plug',
    primaryRootInstructionPath: '.plug/ROOT.md',
    generateRules: () => [],
    importFrom: async () => [],
  },
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
  emptyImportMessage: 'none',
  lintRules: null,
  project: {
    rootInstructionPath: '.plug/ROOT.md',
    managedOutputs: { dirs: [], files: ['.plug/ROOT.md'], supersededFiles: ['.plug/LEGACY.md'] },
    paths: { rulePath: () => '.plug/ROOT.md', commandPath: () => null, agentPath: () => null },
  },
  buildImportPaths: async () => {},
  detectionPaths: ['.plug'],
};

describe('findStaleGeneratedOutputs: superseded files of a registered plugin', () => {
  it('evicts the plugin superseded path only when its primary root is emitted', async () => {
    registerTargetDescriptor(PLUGIN);
    await mkdir(join(root, '.plug'), { recursive: true });
    await writeFile(join(root, '.plug/LEGACY.md'), 'old\n', 'utf-8');
    const base = { projectRoot: root, targets: ['plug'], generatedOutputs: [] as string[] };
    expect(await findStaleGeneratedOutputs({ ...base, expectedPaths: [] })).toEqual([]);
    expect(await findStaleGeneratedOutputs({ ...base, expectedPaths: ['.plug/ROOT.md'] })).toEqual([
      '.plug/LEGACY.md',
    ]);
  });
});

describe('findStaleGeneratedOutputs: static managed files', () => {
  it('keeps a file agentsmesh never wrote (no provenance in the lock)', async () => {
    const stale = await findStaleGeneratedOutputs({
      projectRoot: root,
      targets: ['claude-code'],
      expectedPaths: [],
      generatedOutputs: [],
    });
    expect(stale).toEqual([]);
  });

  it('evicts a file the previous run recorded as generated output', async () => {
    const stale = await findStaleGeneratedOutputs({
      projectRoot: root,
      targets: ['claude-code'],
      expectedPaths: [],
      generatedOutputs: [staticFile()],
    });
    expect(stale).toEqual([staticFile()]);
  });

  it('still reports it when no provenance is supplied at all (report mode)', async () => {
    const stale = await findStaleGeneratedOutputs({
      projectRoot: root,
      targets: ['claude-code'],
      expectedPaths: [],
    });
    expect(stale).toEqual([staticFile()]);
  });
});
