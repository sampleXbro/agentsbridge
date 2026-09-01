import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { generate } from '../../../../src/core/generate/engine.js';
import { getBuiltinTargetDefinition } from '../../../../src/targets/catalog/builtin-targets.js';
import { generateIgnore } from '../../../../src/targets/warp/generator.js';
import { importFromWarp } from '../../../../src/targets/warp/importer.js';
import { lintIgnore } from '../../../../src/targets/warp/lint.js';
import { WARP_IGNORE_FILE } from '../../../../src/targets/warp/constants.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';

function makeCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
    ...overrides,
  };
}

function makeConfig(): ValidatedConfig {
  return {
    version: 1,
    targets: ['warp'],
    features: ['ignore'],
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
  } as ValidatedConfig;
}

function tempRoot(label: string): string {
  const root = join(tmpdir(), `warp-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(root, '.agentsmesh'), { recursive: true });
  return root;
}

describe('warp ignore (project scope, native)', () => {
  it('exposes the documented .warpindexingignore path', () => {
    expect(WARP_IGNORE_FILE).toBe('.warpindexingignore');
  });

  it('declares ignore native at project scope and partial at global scope', () => {
    const descriptor = getBuiltinTargetDefinition('warp')!;
    expect(descriptor.capabilities.ignore).toBe('native');
    expect(descriptor.globalSupport!.capabilities.ignore).toBe('partial');
  });

  it('generates .warpindexingignore with gitignore-syntax lines', () => {
    const outputs = generateIgnore(
      makeCanonical({ ignore: ['node_modules/', '*.log', '!keep.log'] }),
    );
    expect(outputs).toEqual([
      { path: WARP_IGNORE_FILE, content: 'node_modules/\n*.log\n!keep.log' },
    ]);
  });

  it('generates nothing when there are no canonical ignore patterns', () => {
    expect(generateIgnore(makeCanonical())).toEqual([]);
  });

  it('emits exactly one project file and never touches sibling tools ignore files', async () => {
    const root = tempRoot('ignore-project');
    const results = await generate({
      config: makeConfig(),
      canonical: makeCanonical({ ignore: ['dist/'] }),
      projectRoot: root,
      scope: 'project',
    });

    expect(results.map((r) => r.path)).toEqual([WARP_IGNORE_FILE]);
    rmSync(root, { recursive: true, force: true });
  });

  it('does not emit .warpindexingignore at global scope', async () => {
    const root = tempRoot('ignore-global');
    const results = await generate({
      config: makeConfig(),
      canonical: makeCanonical({ ignore: ['dist/'] }),
      projectRoot: root,
      scope: 'global',
    });

    expect(results).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });

  it('imports .warpindexingignore back into .agentsmesh/ignore', async () => {
    const root = tempRoot('ignore-import');
    writeFileSync(join(root, WARP_IGNORE_FILE), 'node_modules/\n*.log\n', 'utf-8');

    const results = await importFromWarp(root, { scope: 'project' });

    const ignoreResult = results.find((r) => r.feature === 'ignore');
    expect(ignoreResult).toBeDefined();
    expect(ignoreResult!.fromTool).toBe('warp');
    expect(ignoreResult!.fromPath).toBe(join(root, WARP_IGNORE_FILE));
    expect(ignoreResult!.toPath).toBe('.agentsmesh/ignore');
    expect(readFileSync(join(root, '.agentsmesh/ignore'), 'utf-8')).toBe('node_modules/\n*.log');
    rmSync(root, { recursive: true, force: true });
  });

  it('does not import .warpindexingignore at global scope', async () => {
    const root = tempRoot('ignore-import-global');
    writeFileSync(join(root, WARP_IGNORE_FILE), 'node_modules/\n', 'utf-8');

    const results = await importFromWarp(root, { scope: 'global' });

    expect(results.find((r) => r.feature === 'ignore')).toBeUndefined();
    rmSync(root, { recursive: true, force: true });
  });

  it('declares .warpindexingignore as a managed project output and detection path', () => {
    const descriptor = getBuiltinTargetDefinition('warp')!;
    expect(descriptor.project.managedOutputs!.files).toContain(WARP_IGNORE_FILE);
    expect(descriptor.detectionPaths).toContain(WARP_IGNORE_FILE);
  });
});

describe('lintIgnore (warp)', () => {
  it('stays silent at project scope now that .warpindexingignore is generated', () => {
    expect(lintIgnore(makeCanonical({ ignore: ['dist/'] }), { scope: 'project' })).toEqual([]);
  });

  it('warns at global scope where Warp has no home-level ignore file', () => {
    const results = lintIgnore(makeCanonical({ ignore: ['dist/'] }), { scope: 'global' });
    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
    expect(results[0].target).toBe('warp');
    expect(results[0].message).toContain('.warpindexingignore');
  });

  it('stays silent at global scope when there are no patterns', () => {
    expect(lintIgnore(makeCanonical(), { scope: 'global' })).toEqual([]);
  });
});
