/**
 * Branch coverage for src/targets/kilo-code/importer.ts importLegacyModes:
 * - .kilocodemodes file missing → no result.
 * - malformed YAML catch branch.
 * - customModes not an array → no result.
 * - mode without slug skipped.
 * - mode with name and description applied to frontmatter.
 * - whenToUse vs no whenToUse body composition.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFromKiloCode } from '../../../../src/targets/kilo-code/importer.js';

let projectRoot = '';

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'am-kilo-legacy-'));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('importFromKiloCode — legacy modes branches', () => {
  it('does nothing when .kilocodemodes is missing', async () => {
    const results = await importFromKiloCode(projectRoot);
    expect(results.find((r) => r.feature === 'agents')).toBeUndefined();
  });

  it('ignores .kilocodemodes with malformed YAML', async () => {
    writeFileSync(join(projectRoot, '.kilocodemodes'), '{ not valid yaml: ::\n');
    const results = await importFromKiloCode(projectRoot);
    expect(results.find((r) => r.feature === 'agents')).toBeUndefined();
  });

  it('ignores .kilocodemodes when customModes is not an array', async () => {
    writeFileSync(join(projectRoot, '.kilocodemodes'), 'customModes: not-an-array\n');
    const results = await importFromKiloCode(projectRoot);
    expect(results.find((r) => r.feature === 'agents')).toBeUndefined();
  });

  it('skips modes without slug or with non-string slug', async () => {
    writeFileSync(
      join(projectRoot, '.kilocodemodes'),
      [
        'customModes:',
        '  - description: missing slug',
        '  - slug: ""',
        '    description: empty slug',
        '  - slug: valid',
        '    description: kept',
        '    roleDefinition: do stuff',
        '',
      ].join('\n'),
    );
    const results = await importFromKiloCode(projectRoot);
    const agents = results.filter((r) => r.feature === 'agents');
    expect(agents).toHaveLength(1);
    expect(agents[0]!.toPath).toContain('valid.md');
  });

  it('appends "## When to use" section when whenToUse is provided', async () => {
    writeFileSync(
      join(projectRoot, '.kilocodemodes'),
      [
        'customModes:',
        '  - slug: planner',
        '    name: Planner Mode',
        '    description: plans tasks',
        '    roleDefinition: You are a planner.',
        '    whenToUse: When the user asks to plan.',
        '',
      ].join('\n'),
    );
    const results = await importFromKiloCode(projectRoot);
    expect(results.find((r) => r.toPath.endsWith('planner.md'))).toBeDefined();
    const importedPath = join(projectRoot, '.agentsmesh/agents/planner.md');
    expect(existsSync(importedPath)).toBe(true);
    const content = readFileSync(importedPath, 'utf-8');
    expect(content).toContain('## When to use');
    expect(content).toContain('When the user asks to plan');
    expect(content).toContain('name: Planner Mode');
  });

  it('omits whenToUse section when not provided', async () => {
    writeFileSync(
      join(projectRoot, '.kilocodemodes'),
      ['customModes:', '  - slug: simple', '    roleDefinition: just role.', ''].join('\n'),
    );
    const results = await importFromKiloCode(projectRoot);
    expect(results.find((r) => r.toPath.endsWith('simple.md'))).toBeDefined();
    const importedPath = join(projectRoot, '.agentsmesh/agents/simple.md');
    const content = readFileSync(importedPath, 'utf-8');
    expect(content).not.toContain('## When to use');
  });
});
