import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanonicalProject } from '../e2e/helpers/canonical.js';
import { appendGenerateReferenceMatrix } from '../e2e/helpers/reference-matrix.js';
import { cleanup } from '../e2e/helpers/setup.js';
import { runGenerate } from '../../src/cli/commands/generate.js';
import { loadScopedConfig } from '../../src/config/core/scope.js';
import { loadCanonicalWithExtends } from '../../src/canonical/extends/extends.js';
import { runLint } from '../../src/core/lint/linter.js';
import { getTargetCatalogEntry } from '../../src/targets/catalog/target-catalog.js';
import { getTargetPrimaryRootInstructionPath } from '../../src/targets/catalog/builtin-targets.js';
import { TARGET_IDS, type BuiltinTargetId } from '../../src/targets/catalog/target-ids.js';
import { TARGET_CONTRACTS, TARGET_SPECIFIC_PREFIXES } from './contracts/index.js';
import { MATRIX_CONFIG } from './matrix-config.js';
import { assertParsableGeneratedFile } from './parse-generated-shape.js';
import { canonicalPathsOnDisk, generatedPathsOnDisk } from './matrix-helpers.js';
import { LESSONS_PROCEDURAL_RULE } from '../../src/lessons/paths.js';

let dir = '';

afterEach(() => {
  if (dir) cleanup(dir);
  dir = '';
});

/** Match e2e `expectNoTargetSpecificPrefixes`: matrix prose may cite `.agentsmesh/` for rewriter coverage. */
function expectNoTargetSpecificPrefixes(content: string): void {
  for (const prefix of TARGET_SPECIFIC_PREFIXES) {
    expect(content).not.toContain(prefix);
  }
}

function writeLessonsRoot(dir: string): void {
  writeFileSync(
    join(dir, '.agentsmesh/rules/_root.md'),
    `---\nroot: true\ndescription: ""\n---\n\n# Operational Guidelines\n\n${LESSONS_PROCEDURAL_RULE}\n`,
    'utf8',
  );
}

function expectLessonsRitual(content: string): void {
  expect(content).toContain('**Recall');
  expect(content).toContain('**Capture');
  expect(content).toContain('.agentsmesh/lessons/index.yaml');
  expect(content).toContain('.agentsmesh/lessons/journal.md');
}

function readGeneratedLessonsRoot(dir: string, target: BuiltinTargetId): string {
  const rootPath = getTargetPrimaryRootInstructionPath(target);
  const candidates = rootPath === undefined ? TARGET_CONTRACTS[target].generated : [rootPath];
  for (const rel of candidates) {
    const path = join(dir, rel);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, 'utf-8');
    if (content.includes('.agentsmesh/lessons/index.yaml')) return content;
  }
  throw new Error(`${target} did not project the lessons ritual into any generated root file`);
}

describe('target contract matrix (in-process)', () => {
  it('lists every builtin target', () => {
    expect([...TARGET_IDS].sort()).toEqual(Object.keys(TARGET_CONTRACTS).sort() as string[]);
  });

  it.each(TARGET_IDS)(
    'generate path + parse + no native-prefix leak + lint clean for %s',
    async (target) => {
      dir = createCanonicalProject(MATRIX_CONFIG);
      appendGenerateReferenceMatrix(dir);
      expect((await runGenerate({ targets: target }, dir, { printMatrix: false })).exitCode).toBe(
        0,
      );
      expect(generatedPathsOnDisk(dir)).toEqual([...TARGET_CONTRACTS[target].generated]);

      const { config, context } = await loadScopedConfig(dir, 'project');
      const { canonical } = await loadCanonicalWithExtends(
        config,
        context.configDir,
        {},
        context.canonicalDir,
      );
      const lint = await runLint(config, canonical, context.rootBase, [target], {
        scope: 'project',
      });
      expect(lint.hasErrors, JSON.stringify(lint.diagnostics)).toBe(false);

      for (const rel of TARGET_CONTRACTS[target].generated) {
        assertParsableGeneratedFile(join(dir, rel), rel);
        const body = readFileSync(join(dir, rel), 'utf-8');
        // Reference-matrix prose cites native paths (including `.agents/`, `.cline/`, …) by design (see e2e).
        if (
          !body.includes('## Rewrite Matrix') &&
          !(body.includes('Plain:') && body.includes('Status markers:'))
        ) {
          expectNoTargetSpecificPrefixes(body);
        }
      }
    },
  );

  it.each(TARGET_IDS)('projects the lessons ritual into %s root instructions', async (target) => {
    dir = createCanonicalProject(`version: 1
targets: [${target}]
features: [rules]
`);
    writeLessonsRoot(dir);

    expect((await runGenerate({ targets: target }, dir, { printMatrix: false })).exitCode).toBe(0);
    expectLessonsRitual(readGeneratedLessonsRoot(dir, target));
  });

  it.each(TARGET_IDS)('import round-trip paths for %s', async (target) => {
    dir = createCanonicalProject(MATRIX_CONFIG);
    appendGenerateReferenceMatrix(dir);
    expect((await runGenerate({ targets: target }, dir, { printMatrix: false })).exitCode).toBe(0);
    rmSync(join(dir, '.agentsmesh'), { recursive: true, force: true });
    await getTargetCatalogEntry(target).importFrom(dir, { scope: 'project' });
    expect(canonicalPathsOnDisk(dir)).toEqual([...TARGET_CONTRACTS[target].imported]);
    const root = readFileSync(join(dir, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(root).toContain('.agentsmesh/commands/review.md');
    // Reference-matrix prose cites native paths by design; skip check when matrix is embedded.
    if (
      !root.includes('## Rewrite Matrix') &&
      !(root.includes('Plain:') && root.includes('Status markers:'))
    ) {
      expectNoTargetSpecificPrefixes(root);
    }
  });

  it.each(TARGET_IDS)('import preserves the lessons ritual for %s', async (target) => {
    dir = createCanonicalProject(`version: 1
targets: [${target}]
features: [rules]
`);
    writeLessonsRoot(dir);
    expect((await runGenerate({ targets: target }, dir, { printMatrix: false })).exitCode).toBe(0);
    rmSync(join(dir, '.agentsmesh'), { recursive: true, force: true });

    await getTargetCatalogEntry(target).importFrom(dir, { scope: 'project' });

    expectLessonsRitual(readFileSync(join(dir, '.agentsmesh/rules/_root.md'), 'utf-8'));
  });

  it.each(TARGET_IDS)('generate → import → generate --check for %s', async (target) => {
    dir = createCanonicalProject(`version: 1
targets: [${target}]
features: [rules, commands, agents, skills, mcp, hooks, ignore, permissions]
`);
    if (target === 'gemini-cli') {
      rmSync(join(dir, '.agentsmesh', 'rules', 'typescript.md'), { force: true });
    }
    expect((await runGenerate({ targets: target }, dir, { printMatrix: false })).exitCode).toBe(0);
    rmSync(join(dir, '.agentsmesh'), { recursive: true, force: true });
    await getTargetCatalogEntry(target).importFrom(dir, { scope: 'project' });
    expect((await runGenerate({ targets: target }, dir, { printMatrix: false })).exitCode).toBe(0);
    expect(
      (await runGenerate({ targets: target, check: true }, dir, { printMatrix: false })).exitCode,
    ).toBe(0);
  });

  it('removes stale files under managed output (cursor)', async () => {
    const target: BuiltinTargetId = 'cursor';
    dir = createCanonicalProject(MATRIX_CONFIG);
    appendGenerateReferenceMatrix(dir);
    expect((await runGenerate({ targets: target }, dir, { printMatrix: false })).exitCode).toBe(0);
    const stale = join(dir, '.cursor', 'agents', 'stale-contract-junk.md');
    writeFileSync(stale, '---\nname: stale\n---\n# Stale');
    expect((await runGenerate({ targets: target }, dir, { printMatrix: false })).exitCode).toBe(0);
    expect(existsSync(stale)).toBe(false);
  });

  it('resolves AGENTS.md overlap for gemini-cli + windsurf', async () => {
    dir = createCanonicalProject(`version: 1
targets: [gemini-cli, windsurf]
features: [rules, commands, agents, skills, mcp, hooks, ignore, permissions]
`);
    appendGenerateReferenceMatrix(dir);
    expect((await runGenerate({}, dir, { printMatrix: false })).exitCode).toBe(0);
    expect(existsSync(join(dir, 'AGENTS.md'))).toBe(true);
  });
});
