/**
 * Global rules land in `~/.config/zed/AGENTS.md`.
 *
 * `crates/paths/src/paths.rs` `agents_file()` resolves `config_dir()/AGENTS.md`
 * and `docs/src/ai/instructions.md` documents exactly one personal instruction
 * file, so secondary rules can only be concatenated into it — hence
 * `additionalRules: 'embedded'` rather than `'native'`.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import { generate } from '../../../../src/core/generate/engine.js';
import { descriptor } from '../../../../src/targets/zed/index.js';
import { importFromZed } from '../../../../src/targets/zed/importer.js';
import {
  ZED_ROOT_FILE,
  ZED_GLOBAL_ROOT_FILE,
  ZED_GLOBAL_SETTINGS_FILE,
} from '../../../../src/targets/zed/constants.js';

function globalConfig(): ValidatedConfig {
  return {
    version: 1,
    targets: ['zed'],
    features: ['rules'],
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
  } as ValidatedConfig;
}

function canonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
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

const rootRule = {
  source: '/proj/.agentsmesh/rules/_root.md',
  root: true,
  targets: [],
  description: '',
  globs: [],
  body: '# Root\n\nAlways run the tests.',
};

const extraRule = {
  source: '/proj/.agentsmesh/rules/typescript.md',
  root: false,
  targets: [],
  description: 'TypeScript rules',
  globs: [],
  body: 'Prefer unknown over any.',
};

describe('zed global layout — rules', () => {
  it('declares the personal instruction file as the global root instruction', () => {
    expect(descriptor.globalSupport!.layout.rootInstructionPath).toBe(ZED_GLOBAL_ROOT_FILE);
    expect(ZED_GLOBAL_ROOT_FILE).toBe('.config/zed/AGENTS.md');
  });

  it('resolves every global rule to that one file', () => {
    const paths = descriptor.globalSupport!.layout.paths;
    expect(paths.rulePath('typescript', extraRule)).toBe(ZED_GLOBAL_ROOT_FILE);
  });

  it('rewrites the project root path to the global one', () => {
    expect(descriptor.globalSupport!.layout.rewriteGeneratedPath!(ZED_ROOT_FILE)).toBe(
      ZED_GLOBAL_ROOT_FILE,
    );
  });

  it('lists the root file as managed, but never the user settings file', () => {
    const managed = descriptor.globalSupport!.layout.managedOutputs!;
    expect(managed.files).toEqual([ZED_GLOBAL_ROOT_FILE]);
    expect(managed.files).not.toContain(ZED_GLOBAL_SETTINGS_FILE);
    expect(descriptor.project.managedOutputs!.files).toEqual([ZED_ROOT_FILE]);
  });

  it('upgrades the global capabilities', () => {
    expect(descriptor.globalSupport!.capabilities.rules).toBe('native');
    expect(descriptor.globalSupport!.capabilities.additionalRules).toBe('embedded');
  });

  it('detects an existing personal instruction file', () => {
    expect(descriptor.globalSupport!.detectionPaths).toContain(ZED_GLOBAL_ROOT_FILE);
  });
});

describe('zed global rules generate + import', () => {
  let root = '';

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'am-zed-global-rules-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('writes the root rule and embeds the secondary ones in one file', async () => {
    const results = await generate({
      config: globalConfig(),
      canonical: canonical({ rules: [rootRule, extraRule] }),
      projectRoot: root,
      scope: 'global',
    });

    expect(results.map((r) => r.path)).toEqual([ZED_GLOBAL_ROOT_FILE]);
    expect(results[0]!.content).toContain('Always run the tests.');
    expect(results[0]!.content).toContain('Prefer unknown over any.');
  });

  it('imports that same file back to the canonical root rule', async () => {
    mkdirSync(join(root, '.config', 'zed'), { recursive: true });
    writeFileSync(join(root, ZED_GLOBAL_ROOT_FILE), '# Root\n\nAlways run the tests.\n');

    const results = await importFromZed(root, { scope: 'global' });

    const rules = results.filter((r) => r.feature === 'rules');
    expect(rules).toHaveLength(1);
    expect(rules[0]!.toPath).toBe('.agentsmesh/rules/_root.md');
    expect(readFileSync(join(root, '.agentsmesh/rules/_root.md'), 'utf8')).toContain(
      'Always run the tests.',
    );
  });

  it('does not read the project .rules file in global scope', async () => {
    writeFileSync(join(root, ZED_ROOT_FILE), '# Project root\n');
    const results = await importFromZed(root, { scope: 'global' });
    expect(results.filter((r) => r.feature === 'rules')).toEqual([]);
  });
});
