/**
 * Comprehensive integration coverage for the Programmatic API surface
 * exposed via `agentsmesh`, `agentsmesh/engine`, `agentsmesh/canonical`, and
 * `agentsmesh/targets`.
 *
 * Covers: every runtime function, every error class with its `code`,
 * registerTargetDescriptor wiring through generate, end-to-end import,
 * lock-sync drift detection, and pure diff computation.
 *
 * Strict assertions only: exact paths, exact counts, exact error codes.
 *
 * Imports from `src/public/*` directly (not `dist/`) so this test runs in
 * `pnpm test` without a build step. The dist-side packaging contract is
 * covered by `tests/consumer-smoke/` (types) and the existing CLI/E2E suites.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  AgentsMeshError,
  ConfigNotFoundError,
  ConfigValidationError,
  TargetNotFoundError,
  check,
  computeDiff,
  diff,
  formatDiffSummary,
  generate,
  getAllDescriptors,
  getDescriptor,
  getTargetCatalog,
  importFrom,
  lint,
  loadProjectContext,
  loadCanonical,
  loadCanonicalFiles,
  loadConfig,
  loadConfigFromDirectory,
  registerTargetDescriptor,
  resolveOutputCollisions,
  type CanonicalFiles,
  type GenerateContext,
  type GenerateResult,
  type LintResult,
  type LockSyncReport,
  type ProjectContext,
  type TargetDescriptor,
  type ValidatedConfig,
} from '../../src/public/index.js';

const TEST_ROOT = join(tmpdir(), `am-public-api-${process.pid}-${Date.now()}`);

interface FixtureRefs {
  readonly projectRoot: string;
  readonly canonicalDir: string;
}

function createMinimalProject(name: string): FixtureRefs {
  const projectRoot = join(TEST_ROOT, name);
  const canonicalDir = join(projectRoot, '.agentsmesh');
  mkdirSync(join(canonicalDir, 'rules'), { recursive: true });
  writeFileSync(
    join(projectRoot, 'agentsmesh.yaml'),
    `version: 1
targets: [claude-code, cursor]
features: [rules]
`,
  );
  writeFileSync(
    join(canonicalDir, 'rules', '_root.md'),
    `---
root: true
description: "Project rules"
---
# Rules
- Use TypeScript
`,
  );
  return { projectRoot, canonicalDir };
}

function makeTestPluginDescriptor(
  id: string,
  overrides: Partial<TargetDescriptor> = {},
): TargetDescriptor {
  const descriptor: TargetDescriptor = {
    id,
    generators: {
      name: id,
      generateRules: () => [{ path: `.test-plugin/${id}.md`, content: `# ${id}` }],
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
    emptyImportMessage: `no ${id} config`,
    lintRules: null,
    project: {
      rootInstructionPath: `.test-plugin/${id}.md`,
      managedOutputs: { dirs: [], files: [`.test-plugin/${id}.md`] },
      paths: {
        rulePath: () => `.test-plugin/${id}.md`,
        commandPath: () => null,
        agentPath: () => null,
      },
    },
    buildImportPaths: async () => {},
    detectionPaths: ['.test-plugin'],
    ...overrides,
  };
  return descriptor;
}

beforeEach(() => {
  mkdirSync(TEST_ROOT, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

describe('Programmatic API — entrypoint shape', () => {
  it('every runtime function is callable and every error class is constructible', () => {
    expect(typeof generate).toBe('function');
    expect(typeof importFrom).toBe('function');
    expect(typeof loadProjectContext).toBe('function');
    expect(typeof loadCanonical).toBe('function');
    expect(typeof loadCanonicalFiles).toBe('function');
    expect(typeof loadConfig).toBe('function');
    expect(typeof loadConfigFromDirectory).toBe('function');
    expect(typeof lint).toBe('function');
    expect(typeof diff).toBe('function');
    expect(typeof check).toBe('function');
    expect(typeof computeDiff).toBe('function');
    expect(typeof formatDiffSummary).toBe('function');
    expect(typeof resolveOutputCollisions).toBe('function');
    expect(typeof registerTargetDescriptor).toBe('function');
    expect(typeof getDescriptor).toBe('function');
    expect(typeof getAllDescriptors).toBe('function');
    expect(typeof getTargetCatalog).toBe('function');

    expect(new ConfigNotFoundError('/x')).toBeInstanceOf(AgentsMeshError);
    expect(new ConfigValidationError('/x', ['issue'])).toBeInstanceOf(AgentsMeshError);
    expect(new TargetNotFoundError('foo')).toBeInstanceOf(AgentsMeshError);
  });
});

describe('Programmatic API — loadConfig / loadConfigFromDirectory', () => {
  it('loadConfig returns a typed ValidatedConfig and the configDir', async () => {
    const { projectRoot } = createMinimalProject('load-config');
    const { config, configDir } = await loadConfig(projectRoot);
    const typed: ValidatedConfig = config;
    expect(typed.version).toBe(1);
    expect(typed.targets).toEqual(['claude-code', 'cursor']);
    expect(typed.features).toEqual(['rules']);
    expect(configDir).toBe(projectRoot);
  });

  it('loadConfig throws ConfigNotFoundError with code AM_CONFIG_NOT_FOUND when missing', async () => {
    const dir = join(TEST_ROOT, 'no-config');
    mkdirSync(dir, { recursive: true });
    const err = await loadConfig(dir).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ConfigNotFoundError);
    expect((err as ConfigNotFoundError).code).toBe('AM_CONFIG_NOT_FOUND');
    expect((err as ConfigNotFoundError).path).toContain('agentsmesh.yaml');
  });

  it('loadConfig throws ConfigValidationError with code AM_CONFIG_INVALID for bad schema', async () => {
    const dir = join(TEST_ROOT, 'bad-schema');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'agentsmesh.yaml'),
      'version: 99\ntargets: [not-a-real-target]\nfeatures: [rules]\n',
    );
    const err = await loadConfig(dir).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ConfigValidationError);
    expect((err as ConfigValidationError).code).toBe('AM_CONFIG_INVALID');
    expect((err as ConfigValidationError).issues.length).toBeGreaterThan(0);
  });

  it('loadConfigFromDirectory reads the exact directory without searching upward', async () => {
    const { projectRoot } = createMinimalProject('load-exact');
    const { config } = await loadConfigFromDirectory(projectRoot);
    expect(config.version).toBe(1);
  });
});

describe('Programmatic API — loadCanonical', () => {
  it('loads canonical files from a project root', async () => {
    const { projectRoot } = createMinimalProject('load-canonical');
    const canonical: CanonicalFiles = await loadCanonical(projectRoot);
    expect(canonical.rules).toHaveLength(1);
    expect(canonical.rules[0]?.root).toBe(true);
    expect(canonical.rules[0]?.body).toContain('Use TypeScript');
  });

  it('loadCanonicalFiles reads local canonical content without extends or packs', async () => {
    const { projectRoot } = createMinimalProject('load-canonical-local-only');
    const a = await loadCanonical(projectRoot);
    const b = await loadCanonicalFiles(projectRoot);
    expect(b.rules).toHaveLength(a.rules.length);
  });

  it('loadCanonical rejects partial preloaded config options', async () => {
    const { projectRoot } = createMinimalProject('load-canonical-option-pairs');
    const { config } = await loadConfig(projectRoot);
    await expect(loadCanonical(projectRoot, { config })).rejects.toThrow(
      /both config and configDir/,
    );
    await expect(loadCanonical(projectRoot, { configDir: projectRoot })).rejects.toThrow(
      /both config and configDir/,
    );
  });

  it('loadCanonical and loadProjectContext include extends and packs like the CLI', async () => {
    const { projectRoot, canonicalDir } = createMinimalProject('load-merged-canonical');
    mkdirSync(join(projectRoot, 'shared', '.agentsmesh', 'rules'), { recursive: true });
    mkdirSync(join(canonicalDir, 'packs', 'review-pack', 'rules'), { recursive: true });
    writeFileSync(
      join(projectRoot, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
extends:
  - name: shared
    source: ./shared
    features: [rules]
`,
    );
    writeFileSync(
      join(projectRoot, 'shared', '.agentsmesh', 'rules', 'shared.md'),
      `---
description: Shared rule
---
# Shared
`,
    );
    writeFileSync(
      join(canonicalDir, 'packs', 'review-pack', 'pack.yaml'),
      `name: review-pack
source: local
source_kind: local
installed_at: "2026-04-26T00:00:00Z"
updated_at: "2026-04-26T00:00:00Z"
features: [rules]
content_hash: "sha256:review"
`,
    );
    writeFileSync(
      join(canonicalDir, 'packs', 'review-pack', 'rules', 'pack.md'),
      `---
description: Pack rule
---
# Pack
`,
    );

    const localOnly = await loadCanonicalFiles(projectRoot);
    const explicitLocal = await loadCanonical(projectRoot, { includeExtends: false });
    const merged = await loadCanonical(projectRoot);
    const context: ProjectContext = await loadProjectContext(projectRoot);

    expect(localOnly.rules.map((r) => r.description).sort()).toEqual(['Project rules']);
    expect(explicitLocal.rules.map((r) => r.description).sort()).toEqual(['Project rules']);
    expect(merged.rules.map((r) => r.description).sort()).toEqual([
      'Pack rule',
      'Project rules',
      'Shared rule',
    ]);
    expect(context.canonical.rules.map((r) => r.description).sort()).toEqual([
      'Pack rule',
      'Project rules',
      'Shared rule',
    ]);
    expect(context.projectRoot).toBe(projectRoot);
    expect(context.configDir).toBe(projectRoot);
    expect(context.canonicalDir).toBe(canonicalDir);
  });
});

describe('Programmatic API — generate', () => {
  it('returns the exact set of paths for the configured targets', async () => {
    const { projectRoot } = createMinimalProject('generate-shape');
    const { config } = await loadConfig(projectRoot);
    const canonical = await loadCanonical(projectRoot);

    const ctx: GenerateContext = { config, canonical, projectRoot, scope: 'project' };
    const results: GenerateResult[] = await generate(ctx);

    const paths = results
      .filter((r) => r.target === 'claude-code' || r.target === 'cursor')
      .map((r) => r.path)
      .sort();

    // Cursor emits an AGENTS.md compat file in project mode; both targets share
    // the project-root AGENTS.md superset.
    expect(paths).toEqual([
      '.claude/CLAUDE.md',
      '.cursor/AGENTS.md',
      '.cursor/rules/general.mdc',
      'AGENTS.md',
    ]);
    for (const r of results) {
      expect(r.status).toBe('created');
    }
  });

  it('targetFilter narrows generation to the listed target only', async () => {
    const { projectRoot } = createMinimalProject('generate-filter');
    const { config } = await loadConfig(projectRoot);
    const canonical = await loadCanonical(projectRoot);

    const results = await generate({
      config,
      canonical,
      projectRoot,
      scope: 'project',
      targetFilter: ['claude-code'],
    });

    expect(results.map((r) => r.target).every((t) => t === 'claude-code')).toBe(true);
    expect(results.map((r) => r.path)).toEqual(['.claude/CLAUDE.md']);
  });
});

describe('Programmatic API — registerTargetDescriptor wires plugins through generate', () => {
  it('a registered descriptor produces results when its ID is in config.targets', async () => {
    const dir = join(TEST_ROOT, 'plugin-flow');
    mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(dir, 'agentsmesh.yaml'),
      `version: 1
targets: []
features: [rules]
plugins: []
pluginTargets: [test-plugin-target]
`,
    );
    writeFileSync(
      join(dir, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
description: "Project rules"
---
# Plugin test
- Hello from plugin target
`,
    );

    const generatedFiles: { path: string; content: string }[] = [
      { path: '.test-plugin/plugin.md', content: '# emitted by test plugin' },
    ];

    const fakeDescriptor = makeTestPluginDescriptor('test-plugin-target', {
      generators: {
        name: 'test-plugin-target',
        primaryRootInstructionPath: '.test-plugin/plugin.md',
        generateRules: () => generatedFiles,
        importFrom: async () => [],
      },
      project: {
        rootInstructionPath: '.test-plugin/plugin.md',
        skillDir: '.test-plugin/skills',
        managedOutputs: { dirs: [], files: ['.test-plugin/plugin.md'] },
        paths: {
          rulePath: () => '.test-plugin/plugin.md',
          commandPath: () => null,
          agentPath: () => null,
        },
      },
    });

    registerTargetDescriptor(fakeDescriptor);

    const { config } = await loadConfig(dir);
    const canonical = await loadCanonical(dir);
    const results = await generate({
      config,
      canonical,
      projectRoot: dir,
      scope: 'project',
    });

    const paths = results.filter((r) => r.target === 'test-plugin-target').map((r) => r.path);
    expect(paths).toEqual(['.test-plugin/plugin.md']);
    expect(getDescriptor('test-plugin-target')?.id).toBe('test-plugin-target');
  });
});

describe('Programmatic API — importFrom', () => {
  it('imports a target-native file back into canonical .agentsmesh/', async () => {
    const dir = join(TEST_ROOT, 'import-flow');
    mkdirSync(join(dir, '.cursor', 'rules'), { recursive: true });
    // alwaysApply: false so the rule imports under its own filename rather
    // than collapsing into the canonical _root.md.
    writeFileSync(
      join(dir, '.cursor', 'rules', 'sample.mdc'),
      `---
description: "From cursor"
alwaysApply: false
---
# imported rule
- pattern X
`,
    );
    const results = await importFrom('cursor', { root: dir, scope: 'project' });
    expect(results.length).toBeGreaterThan(0);
    const rulePath = join(dir, '.agentsmesh', 'rules', 'sample.md');
    expect(existsSync(rulePath)).toBe(true);
    expect(readFileSync(rulePath, 'utf-8')).toContain('pattern X');
  });

  it('imports through registered plugin descriptors', async () => {
    const dir = join(TEST_ROOT, 'plugin-import-flow');
    mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
    const pluginDescriptor = makeTestPluginDescriptor('test-plugin-import', {
      generators: {
        name: 'test-plugin-import',
        generateRules: () => [],
        importFrom: async (projectRoot: string) => {
          const toPath = join(projectRoot, '.agentsmesh', 'rules', 'plugin.md');
          writeFileSync(toPath, '# Imported from plugin\n');
          return [
            {
              fromTool: 'test-plugin-import',
              fromPath: join(projectRoot, '.test-plugin', 'plugin.md'),
              toPath: '.agentsmesh/rules/plugin.md',
              feature: 'rules',
            },
          ];
        },
      },
    });
    registerTargetDescriptor(pluginDescriptor);

    const results = await importFrom('test-plugin-import', { root: dir, scope: 'project' });

    expect(results).toHaveLength(1);
    expect(results[0]?.fromTool).toBe('test-plugin-import');
    expect(results[0]?.toPath).toBe('.agentsmesh/rules/plugin.md');
    expect(readFileSync(join(dir, '.agentsmesh', 'rules', 'plugin.md'), 'utf-8')).toBe(
      '# Imported from plugin\n',
    );
  });
});

describe('Programmatic API — lint', () => {
  it('returns { diagnostics, hasErrors } as a structured LintResult', async () => {
    const { projectRoot } = createMinimalProject('lint-shape');
    const { config } = await loadConfig(projectRoot);
    const canonical = await loadCanonical(projectRoot);

    const result: LintResult = await lint({
      config,
      canonical,
      projectRoot,
      scope: 'project',
    });

    expect(result).toHaveProperty('diagnostics');
    expect(result).toHaveProperty('hasErrors');
    expect(Array.isArray(result.diagnostics)).toBe(true);
    expect(typeof result.hasErrors).toBe('boolean');
  });
});

describe('Programmatic API — diff and computeDiff', () => {
  it('computeDiff produces a summary whose totals match the result set', async () => {
    const { projectRoot } = createMinimalProject('compute-diff');
    const { config } = await loadConfig(projectRoot);
    const canonical = await loadCanonical(projectRoot);
    const results = await generate({ config, canonical, projectRoot, scope: 'project' });

    const computed = computeDiff(results);
    const totalDiffs = computed.summary.new + computed.summary.updated + computed.summary.unchanged;
    expect(totalDiffs).toBe(results.length);
    expect(computed.summary.new).toBe(results.length);
    expect(computed.diffs).toHaveLength(results.length);
  });

  it('diff() runs generate internally and returns both diffs and results', async () => {
    const { projectRoot } = createMinimalProject('diff-wrapper');
    const { config } = await loadConfig(projectRoot);
    const canonical = await loadCanonical(projectRoot);

    const result = await diff({ config, canonical, projectRoot, scope: 'project' });
    // Same superset that the generate-paths test asserts: claude/CLAUDE.md,
    // cursor/AGENTS.md, cursor/rules/general.mdc, AGENTS.md → 4 results.
    expect(result.results).toHaveLength(4);
    expect(result.summary.new).toBe(4);
    expect(result.summary.updated).toBe(0);
    expect(result.diffs).toHaveLength(4);
    expect(formatDiffSummary(result.summary)).toBe(
      '4 files would be created, 0 updated, 0 unchanged, 0 deleted',
    );
  });
});

describe('Programmatic API — check (lock-sync)', () => {
  it('returns hasLock=false and inSync=false when no lock file exists', async () => {
    const { projectRoot, canonicalDir } = createMinimalProject('check-no-lock');
    const { config } = await loadConfig(projectRoot);
    const report: LockSyncReport = await check({
      config,
      configDir: projectRoot,
      canonicalDir,
    });
    expect(report.hasLock).toBe(false);
    expect(report.inSync).toBe(false);
    expect(report.modified).toHaveLength(0);
    expect(report.added).toHaveLength(0);
    expect(report.removed).toHaveLength(0);
  });

  it('returns inSync=true when the lock matches the current canonical state', async () => {
    const { projectRoot, canonicalDir } = createMinimalProject('check-in-sync');
    const { writeLock, buildChecksums } = await import('../../src/config/core/lock.js');
    const checksums = await buildChecksums(canonicalDir);
    await writeLock(canonicalDir, {
      generatedAt: '2026-04-25T00:00:00Z',
      generatedBy: 'test',
      libVersion: '0.6.0',
      checksums,
      extends: {},
      packs: {},
    });
    const { config } = await loadConfig(projectRoot);
    const report = await check({ config, configDir: projectRoot, canonicalDir });
    expect(report.hasLock).toBe(true);
    expect(report.inSync).toBe(true);
  });

  it('detects modified canonical files against a stale lock', async () => {
    const { projectRoot, canonicalDir } = createMinimalProject('check-modified');
    const { writeLock } = await import('../../src/config/core/lock.js');
    await writeLock(canonicalDir, {
      generatedAt: '2026-04-25T00:00:00Z',
      generatedBy: 'test',
      libVersion: '0.6.0',
      checksums: {
        'rules/_root.md': 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      },
      extends: {},
      packs: {},
    });
    const { config } = await loadConfig(projectRoot);
    const report = await check({ config, configDir: projectRoot, canonicalDir });
    expect(report.hasLock).toBe(true);
    expect(report.inSync).toBe(false);
    expect(report.modified).toEqual(['rules/_root.md']);
    expect(report.added).toHaveLength(0);
    expect(report.removed).toHaveLength(0);
  });
});

describe('Programmatic API — catalog inspection', () => {
  it('getTargetCatalog returns the same set of IDs as TARGET_IDS', async () => {
    const { TARGET_IDS } = await import('../../src/targets/catalog/target-ids.js');
    const ids = getTargetCatalog()
      .map((d) => d.id)
      .sort();
    expect(ids).toEqual([...TARGET_IDS].sort());
  });

  it('getTargetCatalog does not expose the live built-in array for mutation', () => {
    const originalIds = getTargetCatalog().map((d) => d.id);
    const returned = getTargetCatalog() as TargetDescriptor[];
    try {
      returned.push(makeTestPluginDescriptor('mutated-plugin'));
    } catch {
      // A frozen returned array is also acceptable; the important contract is no leak.
    }
    expect(getTargetCatalog().map((d) => d.id)).toEqual(originalIds);
  });

  it('getTargetCatalog does not expose live descriptor objects for mutation', () => {
    const original = getTargetCatalog()[0];
    expect(original).toBeDefined();
    const originalId = original!.id;
    const originalRules = original!.capabilities.rules;
    const returned = getTargetCatalog() as unknown as {
      id: string;
      capabilities: { rules: string };
    }[];
    try {
      returned[0]!.id = 'mutated-target';
      returned[0]!.capabilities.rules = 'none';
    } catch {
      // Frozen descriptors are acceptable; the important contract is no leak.
    }
    const fresh = getTargetCatalog()[0];
    expect(fresh?.id).toBe(originalId);
    expect(fresh?.capabilities.rules).toEqual(originalRules);
  });

  it('getDescriptor returns undefined for unknown IDs and a typed descriptor for known IDs', () => {
    expect(getDescriptor('definitely-not-a-target')).toBeUndefined();
    const cursor = getDescriptor('cursor');
    expect(cursor?.id).toBe('cursor');
  });

  it('getAllDescriptors returns the registered (plugin) descriptors only', () => {
    // getAllDescriptors is the plugin-registry view; builtins live in
    // getTargetCatalog. registerTargetDescriptor in an earlier test added
    // 'test-plugin-target', so it must appear here.
    const all = getAllDescriptors();
    expect(all.some((d) => d.id === 'test-plugin-target')).toBe(true);
  });
});

describe('Programmatic API — resolveOutputCollisions', () => {
  it('deduplicates results that share the same path with identical content', async () => {
    const dupes: GenerateResult[] = [
      { target: 'a', path: 'shared.md', content: '# x', status: 'created' },
      { target: 'b', path: 'shared.md', content: '# x', status: 'created' },
    ];
    const resolved = resolveOutputCollisions(dupes);
    expect(resolved.length).toBe(1);
    expect(resolved[0]?.path).toBe('shared.md');
  });
});
