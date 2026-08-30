import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getBuiltinTargetDefinition } from '../../../../src/targets/catalog/builtin-targets.js';
import { generate } from '../../../../src/core/generate/engine.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { importFromCrush } from '../../../../src/targets/crush/importer.js';
import {
  CRUSH_IGNORE,
  CRUSH_GLOBAL_IGNORE,
  CRUSH_GLOBAL_CONFIG_DIR,
} from '../../../../src/targets/crush/constants.js';

const PATTERNS = ['node_modules/', 'dist/', '*.log', '!dist/keep.txt'];

function makeConfig(): ValidatedConfig {
  return {
    version: 1,
    targets: ['crush'],
    features: ['ignore'],
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
  } as ValidatedConfig;
}

function makeCanonical(ignore: string[]): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore,
  };
}

describe('crush global ignore — descriptor wiring', () => {
  const descriptor = getBuiltinTargetDefinition('crush')!;

  it('global ignore path is the extensionless ~/.config/crush/ignore', () => {
    expect(CRUSH_GLOBAL_IGNORE).toBe(`${CRUSH_GLOBAL_CONFIG_DIR}/ignore`);
    expect(CRUSH_GLOBAL_IGNORE).toBe('.config/crush/ignore');
  });

  it('global capability for ignore is native', () => {
    expect(descriptor.globalSupport!.capabilities.ignore).toBe('native');
  });

  it('rewriteGeneratedPath maps .crushignore to the global ignore file', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(CRUSH_IGNORE, '')).toBe(CRUSH_GLOBAL_IGNORE);
  });

  it('global managedOutputs.files includes the global ignore file', () => {
    expect(descriptor.globalSupport!.layout.managedOutputs!.files).toContain(CRUSH_GLOBAL_IGNORE);
  });

  it('global detectionPaths include the global ignore file', () => {
    expect(descriptor.globalSupport!.detectionPaths).toContain(CRUSH_GLOBAL_IGNORE);
  });

  it('importer ignore spec reads the global ignore file in global scope', () => {
    expect(descriptor.importer!.ignore!.source.global).toEqual([CRUSH_GLOBAL_IGNORE]);
  });
});

describe('crush global ignore — generate', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'crush-global-ignore-gen-'));
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('emits exactly one ignore file at .config/crush/ignore in global scope', async () => {
    const results = await generate({
      config: makeConfig(),
      canonical: makeCanonical(PATTERNS),
      projectRoot,
      scope: 'global',
    });

    const crushFiles = results.filter((r) => r.target === 'crush');
    expect(crushFiles.map((r) => r.path)).toEqual([CRUSH_GLOBAL_IGNORE]);
    expect(crushFiles[0]!.content).toBe(PATTERNS.join('\n'));
  });

  it('still emits .crushignore in project scope', async () => {
    const results = await generate({
      config: makeConfig(),
      canonical: makeCanonical(PATTERNS),
      projectRoot,
      scope: 'project',
    });

    const crushFiles = results.filter((r) => r.target === 'crush');
    expect(crushFiles.map((r) => r.path)).toEqual([CRUSH_IGNORE]);
  });

  it('emits nothing when canonical ignore is empty in global scope', async () => {
    const results = await generate({
      config: makeConfig(),
      canonical: makeCanonical([]),
      projectRoot,
      scope: 'global',
    });

    expect(results.filter((r) => r.target === 'crush')).toEqual([]);
  });
});

describe('crush global ignore — import', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'crush-global-ignore-imp-'));
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('imports .config/crush/ignore into canonical .agentsmesh/ignore', async () => {
    await mkdir(join(projectRoot, CRUSH_GLOBAL_CONFIG_DIR), { recursive: true });
    await writeFile(join(projectRoot, CRUSH_GLOBAL_IGNORE), `${PATTERNS.join('\n')}\n`, 'utf-8');

    const results = await importFromCrush(projectRoot, { scope: 'global' });

    const ignoreResult = results.find((r) => r.feature === 'ignore');
    expect(ignoreResult).toBeDefined();
    expect(ignoreResult!.fromTool).toBe('crush');
    expect(ignoreResult!.toPath).toBe('.agentsmesh/ignore');
    expect(ignoreResult!.fromPath).toBe(join(projectRoot, CRUSH_GLOBAL_IGNORE));

    const content = await readFile(join(projectRoot, '.agentsmesh/ignore'), 'utf-8');
    expect(content).toBe(PATTERNS.join('\n'));
  });

  it('does not read project .crushignore in global scope', async () => {
    await writeFile(join(projectRoot, CRUSH_IGNORE), 'project-only/\n', 'utf-8');

    const results = await importFromCrush(projectRoot, { scope: 'global' });

    expect(results.find((r) => r.feature === 'ignore')).toBeUndefined();
  });
});

describe('crush global ignore — round trip', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'crush-global-ignore-rt-'));
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('generate --global then import --global recovers the canonical patterns', async () => {
    const results = await generate({
      config: makeConfig(),
      canonical: makeCanonical(PATTERNS),
      projectRoot,
      scope: 'global',
    });
    const generated = results.find((r) => r.target === 'crush' && r.path === CRUSH_GLOBAL_IGNORE);
    expect(generated).toBeDefined();

    await mkdir(join(projectRoot, CRUSH_GLOBAL_CONFIG_DIR), { recursive: true });
    await writeFile(join(projectRoot, CRUSH_GLOBAL_IGNORE), generated!.content, 'utf-8');

    await importFromCrush(projectRoot, { scope: 'global' });

    const canonical = await readFile(join(projectRoot, '.agentsmesh/ignore'), 'utf-8');
    expect(canonical.split('\n')).toEqual(PATTERNS);
  });
});
