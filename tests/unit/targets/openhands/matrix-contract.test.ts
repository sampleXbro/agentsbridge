/**
 * Mirrors the shared target-contract matrix for openhands: exact generated path
 * set, exact imported canonical path set, lint clean, and a `--check`-stable
 * generate -> import -> generate cycle, all against the full canonical fixture.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createCanonicalProject } from '../../../e2e/helpers/canonical.js';
import { appendGenerateReferenceMatrix } from '../../../e2e/helpers/reference-matrix.js';
import { cleanup } from '../../../e2e/helpers/setup.js';
import { MATRIX_CONFIG } from '../../../contract/matrix-config.js';
import { canonicalPathsOnDisk, generatedPathsOnDisk } from '../../../contract/matrix-helpers.js';
import { runGenerate } from '../../../../src/cli/commands/generate.js';
import { loadScopedConfig } from '../../../../src/config/core/scope.js';
import { loadCanonicalWithExtends } from '../../../../src/canonical/extends/extends.js';
import { runLint } from '../../../../src/core/lint/linter.js';
import { TARGET_SPECIFIC_PREFIXES } from '../../../contract/contracts/index.js';
import { assertParsableGeneratedFile } from '../../../contract/parse-generated-shape.js';
import { scaffoldLessons } from '../../../../src/lessons/init.js';
import { importFromOpenhands } from '../../../../src/targets/openhands/importer.js';

const TARGET = 'openhands';
const CONFIG = MATRIX_CONFIG.replace('  - aider\n', '  - aider\n  - openhands\n');

const GENERATED = [
  '.agents/agents/code-reviewer.md',
  '.agents/agents/researcher.md',
  '.agents/plugins/agentsmesh/.mcp.json',
  '.agents/plugins/agentsmesh/commands/review.md',
  '.agents/skills/api-generator/SKILL.md',
  '.agents/skills/api-generator/references/route-checklist.md',
  '.agents/skills/api-generator/template.ts',
  '.agents/skills/typescript.md',
  '.openhands/hooks.json',
  'AGENTS.md',
];

const IMPORTED = [
  '.agentsmesh/agents/code-reviewer.md',
  '.agentsmesh/agents/researcher.md',
  '.agentsmesh/commands/review.md',
  '.agentsmesh/hooks.yaml',
  '.agentsmesh/mcp.json',
  '.agentsmesh/rules/_root.md',
  '.agentsmesh/rules/typescript.md',
  '.agentsmesh/skills/api-generator/SKILL.md',
  '.agentsmesh/skills/api-generator/references/route-checklist.md',
  '.agentsmesh/skills/api-generator/template.ts',
];

let dir = '';

afterEach(() => {
  if (dir) cleanup(dir);
  dir = '';
});

describe('openhands target contract', () => {
  it('generates exactly the declared path set and lints clean', async () => {
    dir = createCanonicalProject(CONFIG);
    appendGenerateReferenceMatrix(dir);
    expect((await runGenerate({ targets: TARGET }, dir, { printMatrix: false })).exitCode).toBe(0);
    expect(generatedPathsOnDisk(dir)).toEqual(GENERATED);

    const { config, context } = await loadScopedConfig(dir, 'project');
    const { canonical } = await loadCanonicalWithExtends(
      config,
      context.configDir,
      {},
      context.canonicalDir,
    );
    const lint = await runLint(config, canonical, context.rootBase, [TARGET], {
      scope: 'project',
    });
    expect(lint.hasErrors, JSON.stringify(lint.diagnostics)).toBe(false);
  });

  it('imports back exactly the declared canonical path set', async () => {
    dir = createCanonicalProject(CONFIG);
    appendGenerateReferenceMatrix(dir);
    expect((await runGenerate({ targets: TARGET }, dir, { printMatrix: false })).exitCode).toBe(0);
    rmSync(join(dir, '.agentsmesh'), { recursive: true, force: true });

    await importFromOpenhands(dir, { scope: 'project' });

    expect(canonicalPathsOnDisk(dir)).toEqual(IMPORTED);
    expect(readFileSync(join(dir, '.agentsmesh/rules/_root.md'), 'utf-8')).toContain(
      '.agentsmesh/commands/review.md',
    );
  });

  it('stays check-clean across generate -> import -> generate', async () => {
    dir = createCanonicalProject(`version: 1
targets: [${TARGET}]
features: [rules, commands, agents, skills, mcp, hooks, ignore, permissions]
`);
    expect((await runGenerate({ targets: TARGET }, dir, { printMatrix: false })).exitCode).toBe(0);
    rmSync(join(dir, '.agentsmesh'), { recursive: true, force: true });
    await importFromOpenhands(dir, { scope: 'project' });
    expect((await runGenerate({ targets: TARGET }, dir, { printMatrix: false })).exitCode).toBe(0);
    expect(
      (await runGenerate({ targets: TARGET, check: true }, dir, { printMatrix: false })).exitCode,
    ).toBe(0);
  });

  it('writes files that parse under their on-disk format and leak no foreign prefix', async () => {
    dir = createCanonicalProject(CONFIG);
    appendGenerateReferenceMatrix(dir);
    expect((await runGenerate({ targets: TARGET }, dir, { printMatrix: false })).exitCode).toBe(0);

    for (const rel of GENERATED) {
      assertParsableGeneratedFile(join(dir, rel), rel);
      const body = readFileSync(join(dir, rel), 'utf-8');
      // The reference-matrix fixture cites native paths as prose on purpose.
      if (
        body.includes('## Rewrite Matrix') ||
        (body.includes('Plain:') && body.includes('Status markers:'))
      ) {
        continue;
      }
      for (const prefix of TARGET_SPECIFIC_PREFIXES) {
        expect(body, `${rel} leaks ${prefix}`).not.toContain(prefix);
      }
    }
  });

  it('projects the lessons ritual into AGENTS.md', async () => {
    dir = createCanonicalProject(`version: 1
targets: [${TARGET}]
features: [rules]
`);
    await scaffoldLessons(dir);
    expect((await runGenerate({ targets: TARGET }, dir, { printMatrix: false })).exitCode).toBe(0);

    const root = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
    expect(root).toContain('<!-- agentsmesh:lessons-contract:start -->');
    expect(root).toContain('agentsmesh lessons query');
    expect(root).toContain('agentsmesh lessons add');
    expect(root.startsWith('---')).toBe(false);
  });

  it('generates alongside every target that shares .agents/ without a collision', async () => {
    dir = createCanonicalProject(`version: 1
targets: [openhands, antigravity, codex-cli, goose]
features: [rules, commands, agents, skills, mcp, hooks, ignore, permissions]
`);
    expect((await runGenerate({}, dir, { printMatrix: false })).exitCode).toBe(0);
  });

  it('generates alongside every other AGENTS.md-first target without a collision', async () => {
    dir = createCanonicalProject(CONFIG);
    expect((await runGenerate({}, dir, { printMatrix: false })).exitCode).toBe(0);
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf-8')).toContain('# Standards');
  });
});
