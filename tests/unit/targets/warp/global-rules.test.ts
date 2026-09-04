import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { generate } from '../../../../src/core/generate/engine.js';
import { getBuiltinTargetDefinition } from '../../../../src/targets/catalog/builtin-targets.js';
import { importFromWarp } from '../../../../src/targets/warp/importer.js';
import { WARP_ROOT_FILE, WARP_GLOBAL_ROOT_FILE } from '../../../../src/targets/warp/constants.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import type { CanonicalFiles, CanonicalRule } from '../../../../src/core/types.js';

function rule(overrides: Partial<CanonicalRule> = {}): CanonicalRule {
  return {
    source: 'rules/_root.md',
    root: true,
    targets: [],
    description: 'root',
    globs: [],
    body: '# Root\n\nAlways run tests.',
    ...overrides,
  };
}

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
    features: ['rules'],
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

describe('warp global rules', () => {
  const descriptor = getBuiltinTargetDefinition('warp')!;

  it('points global rules at the documented ~/.agents/AGENTS.md path', () => {
    expect(WARP_GLOBAL_ROOT_FILE).toBe('.agents/AGENTS.md');
    expect(descriptor.globalSupport!.layout.rootInstructionPath).toBe(WARP_GLOBAL_ROOT_FILE);
  });

  it('declares rules native and additionalRules embedded at global scope', () => {
    expect(descriptor.globalSupport!.capabilities.rules).toBe('native');
    expect(descriptor.globalSupport!.capabilities.additionalRules).toBe('embedded');
  });

  it('resolves every global rule row to the single AGENTS.md file', () => {
    const rulePath = descriptor.globalSupport!.layout.paths.rulePath(
      'typescript',
      rule({ source: 'rules/typescript.md', root: false }),
    );
    expect(rulePath).toBe(WARP_GLOBAL_ROOT_FILE);
  });

  it('rewrites the project root file path to the global one', () => {
    const rewrite = descriptor.globalSupport!.layout.rewriteGeneratedPath!;
    expect(rewrite(WARP_ROOT_FILE)).toBe(WARP_GLOBAL_ROOT_FILE);
  });

  it('lists the global root file in managed outputs and detection paths', () => {
    expect(descriptor.globalSupport!.layout.managedOutputs!.files).toContain(WARP_GLOBAL_ROOT_FILE);
    expect(descriptor.globalSupport!.detectionPaths).toContain(WARP_GLOBAL_ROOT_FILE);
  });

  it('generates .agents/AGENTS.md with the root rule and embedded secondary rules', async () => {
    const root = tempRoot('global-rules');
    const results = await generate({
      config: makeConfig(),
      canonical: makeCanonical({
        rules: [
          rule(),
          rule({
            source: 'rules/typescript.md',
            root: false,
            description: 'TypeScript standards',
            body: '# TypeScript\n\nUse strict mode.',
          }),
        ],
      }),
      projectRoot: root,
      scope: 'global',
    });

    expect(results.map((r) => r.path)).toEqual([WARP_GLOBAL_ROOT_FILE]);
    const content = results[0].content;
    expect(content).toContain('Always run tests.');
    expect(content).toContain('Use strict mode.');
    rmSync(root, { recursive: true, force: true });
  });

  it('never leaves a bare AGENTS.md at the home root in global mode', async () => {
    const root = tempRoot('global-rules-leak');
    const results = await generate({
      config: makeConfig(),
      canonical: makeCanonical({ rules: [rule()] }),
      projectRoot: root,
      scope: 'global',
    });

    expect(results.some((r) => r.path === WARP_ROOT_FILE)).toBe(false);
    rmSync(root, { recursive: true, force: true });
  });

  it('imports ~/.agents/AGENTS.md as the canonical root rule in global scope', async () => {
    const root = tempRoot('global-rules-import');
    mkdirSync(join(root, '.agents'), { recursive: true });
    writeFileSync(join(root, WARP_GLOBAL_ROOT_FILE), '# Global\n\nPrefer pure functions.', 'utf-8');

    const results = await importFromWarp(root, { scope: 'global' });

    const ruleResult = results.find((r) => r.feature === 'rules');
    expect(ruleResult).toBeDefined();
    expect(ruleResult!.fromPath).toBe(join(root, WARP_GLOBAL_ROOT_FILE));
    expect(ruleResult!.toPath).toBe('.agentsmesh/rules/_root.md');
    const imported = readFileSync(join(root, '.agentsmesh/rules/_root.md'), 'utf-8');
    expect(imported).toContain('root: true');
    expect(imported).toContain('Prefer pure functions.');
    rmSync(root, { recursive: true, force: true });
  });

  it('round-trips generate --global -> import --global', async () => {
    const root = tempRoot('global-rules-rt');
    const results = await generate({
      config: makeConfig(),
      canonical: makeCanonical({ rules: [rule({ body: '# Root\n\nShip small diffs.' })] }),
      projectRoot: root,
      scope: 'global',
    });
    mkdirSync(join(root, '.agents'), { recursive: true });
    writeFileSync(join(root, results[0].path), results[0].content, 'utf-8');

    const imported = await importFromWarp(root, { scope: 'global' });

    expect(imported.find((r) => r.feature === 'rules')).toBeDefined();
    expect(readFileSync(join(root, '.agentsmesh/rules/_root.md'), 'utf-8')).toContain(
      'Ship small diffs.',
    );
    rmSync(root, { recursive: true, force: true });
  });
});
