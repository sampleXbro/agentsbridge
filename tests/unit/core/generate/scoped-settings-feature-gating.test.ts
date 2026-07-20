/**
 * Bug #3: the generate engine must thread the enabled-feature set into
 * `emitScopedSettings`, so disabling a feature suppresses its key from every
 * target's settings sidecar (.gemini / .amp / .zed / .augment settings.json).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generate } from '../../../../src/core/generate/engine.js';
import { generateScopedSettingsFeature } from '../../../../src/core/generate/optional-features.js';
import {
  registerTargetDescriptor,
  resetRegistry,
} from '../../../../src/targets/catalog/registry.js';
import type { GenerateResult } from '../../../../src/core/result-types.js';
import type { TargetDescriptor } from '../../../../src/targets/catalog/target-descriptor.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';

const TEST_DIR = join(tmpdir(), 'am-scoped-gating-test');

function canonical(): CanonicalFiles {
  return {
    rules: [
      {
        source: join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
        root: true,
        targets: [],
        description: '',
        globs: [],
        body: 'Root rule',
      },
    ],
    commands: [],
    agents: [],
    skills: [],
    mcp: { mcpServers: { srv: { type: 'stdio', command: 'npx', args: ['x'] } } },
    permissions: null,
    hooks: { PreToolUse: [{ matcher: 'Bash', command: 'echo hi' }] },
    ignore: [],
  };
}

function config(features: ValidatedConfig['features']): ValidatedConfig {
  return {
    version: 1,
    targets: ['gemini-cli', 'amp', 'zed', 'augment-code'],
    features,
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
  };
}

function settingsFor(
  results: { path: string; content: string }[],
  path: string,
): Record<string, unknown> {
  const out = results.find((r) => r.path === path);
  if (!out) throw new Error(`no result for ${path}`);
  return JSON.parse(out.content) as Record<string, unknown>;
}

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('generate — scoped settings feature gating', () => {
  it('suppresses mcpServers from all settings sidecars when mcp is disabled', async () => {
    const results = await generate({
      config: config(['rules', 'hooks']),
      canonical: canonical(),
      projectRoot: TEST_DIR,
    });

    // zed sidecar only projects mcp -> must not be emitted at all.
    expect(results.some((r) => r.path === '.zed/settings.json')).toBe(false);

    // amp has no hooks settings-file surface (only mcp) -> must not be emitted at all.
    expect(results.some((r) => r.path === '.amp/settings.json')).toBe(false);

    // gemini projects hooks too -> emitted, but without mcpServers.
    const gemini = settingsFor(results, '.gemini/settings.json');
    expect(gemini).not.toHaveProperty('mcpServers');
    expect(gemini).toHaveProperty('hooks');

    // augment projects hooks too -> emitted, but without mcpServers.
    const augment = settingsFor(results, '.augment/settings.json');
    expect(augment).not.toHaveProperty('mcpServers');
    expect(augment).toHaveProperty('hooks');
  });

  it('suppresses hooks but keeps mcpServers when hooks is disabled', async () => {
    const results = await generate({
      config: config(['rules', 'mcp']),
      canonical: canonical(),
      projectRoot: TEST_DIR,
    });

    const gemini = settingsFor(results, '.gemini/settings.json');
    expect(gemini).toHaveProperty('mcpServers');
    expect(gemini).not.toHaveProperty('hooks');

    const augment = settingsFor(results, '.augment/settings.json');
    expect(augment).toHaveProperty('mcpServers');
    expect(augment).not.toHaveProperty('hooks');

    // amp + zed mcp-only sidecars present.
    expect(settingsFor(results, '.amp/settings.json')).toHaveProperty('amp.mcpServers');
    expect(settingsFor(results, '.zed/settings.json')).toHaveProperty('context_servers');
  });
});

/**
 * Plugin alignment: `emitScopedSettings` is a TargetDescriptor hook, so a
 * runtime-registered PLUGIN descriptor must receive the same `enabledFeatures`
 * set and be able to gate on it — the engine call site
 * (`getBuiltinTargetDefinition(target) ?? getDescriptor(target)`) has no
 * builtin-vs-plugin branch. Pre-fix the engine passed only `(canonical, scope)`,
 * so a plugin reading `enabledFeatures.has(...)` threw on `undefined`.
 */
function pluginWithScopedSettings(id: string): TargetDescriptor {
  return {
    id,
    metadata: {
      displayName: id,
      category: 'cli',
      officialUrl: 'https://example.test/scoped',
      shortDescription: `Scoped-settings plugin ${id}`,
    },
    generators: { name: id, generateRules: () => [], importFrom: async () => [] },
    capabilities: {
      rules: 'native',
      additionalRules: 'none',
      commands: 'none',
      agents: 'none',
      skills: 'none',
      mcp: 'native',
      hooks: 'none',
      ignore: 'none',
      permissions: 'none',
    },
    emptyImportMessage: 'No plugin files.',
    lintRules: null,
    project: {
      paths: {
        rulePath: () => '.plugin/rules/root.md',
        commandPath: () => null,
        agentPath: () => null,
      },
    },
    buildImportPaths: async (refs) =>
      refs.set('.plugin/rules/root.md', '.agentsmesh/rules/_root.md'),
    detectionPaths: ['.plugin'],
    // Gates the mcp projection on the feature set the engine must supply.
    emitScopedSettings: (canonical, scope, enabledFeatures) => {
      const settings: Record<string, unknown> = { scope };
      if (enabledFeatures.has('mcp') && canonical.mcp)
        settings.mcpServers = canonical.mcp.mcpServers;
      return [{ path: '.plugin/settings.json', content: JSON.stringify(settings) }];
    },
  };
}

describe('generate — scoped settings feature gating (plugin descriptor)', () => {
  afterEach(() => resetRegistry());

  it('threads enabledFeatures into a plugin emitScopedSettings (mcp enabled → key present)', async () => {
    registerTargetDescriptor(pluginWithScopedSettings('rich-scoped'));
    const results: GenerateResult[] = [];
    await generateScopedSettingsFeature(
      results,
      ['rich-scoped'],
      canonical(),
      TEST_DIR,
      'project',
      new Set(['rules', 'mcp']),
    );
    expect(settingsFor(results, '.plugin/settings.json')).toHaveProperty('mcpServers');
  });

  it('suppresses a plugin settings key when its feature is disabled (mcp off → absent)', async () => {
    registerTargetDescriptor(pluginWithScopedSettings('rich-scoped'));
    const results: GenerateResult[] = [];
    await generateScopedSettingsFeature(
      results,
      ['rich-scoped'],
      canonical(),
      TEST_DIR,
      'project',
      new Set(['rules', 'hooks']),
    );
    expect(settingsFor(results, '.plugin/settings.json')).not.toHaveProperty('mcpServers');
  });
});
