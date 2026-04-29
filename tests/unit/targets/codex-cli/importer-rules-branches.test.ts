/**
 * Branch coverage tests for codex-cli/importer-rules.ts.
 * Targets the four-way `sourcePath` ternary chain (lines 49-56) when both
 * global override and AGENTS.md absent, the codex.md fallback, and the
 * `frontmatter.root === true` short-circuit (line 88).
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { importFromCodex } from '../../../../src/targets/codex-cli/importer.js';
import {
  CODEX_MD,
  AGENTS_MD,
  CODEX_GLOBAL_AGENTS_MD,
  CODEX_GLOBAL_AGENTS_OVERRIDE_MD,
} from '../../../../src/targets/codex-cli/constants.js';

describe('importCodexRules — sourcePath selection branches', () => {
  let projectRoot = '';

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'amesh-cov-'));
  });

  afterEach(() => {
    if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
    projectRoot = '';
  });

  it('global scope picks the override file when present (1st ternary branch)', async () => {
    mkdirSync(join(projectRoot, '.codex'), { recursive: true });
    writeFileSync(join(projectRoot, CODEX_GLOBAL_AGENTS_OVERRIDE_MD), '# Override file root\n');
    writeFileSync(join(projectRoot, CODEX_GLOBAL_AGENTS_MD), '# Plain global root\n');
    const results = await importFromCodex(projectRoot, { scope: 'global' });
    const root = readFileSync(join(projectRoot, '.agentsmesh/rules/_root.md'), 'utf-8');
    expect(root).toContain('# Override file root');
    expect(root).not.toContain('# Plain global root');
    expect(results.some((r) => r.toPath === '.agentsmesh/rules/_root.md')).toBe(true);
  });

  it('falls back to plain global AGENTS.md when override is absent (2nd ternary branch)', async () => {
    mkdirSync(join(projectRoot, '.codex'), { recursive: true });
    writeFileSync(join(projectRoot, CODEX_GLOBAL_AGENTS_MD), '# Plain global root\n');
    const results = await importFromCodex(projectRoot, { scope: 'global' });
    const root = readFileSync(join(projectRoot, '.agentsmesh/rules/_root.md'), 'utf-8');
    expect(root).toContain('# Plain global root');
    expect(results.some((r) => r.toPath === '.agentsmesh/rules/_root.md')).toBe(true);
  });

  it('project scope falls through to codex.md when AGENTS.md missing (4th ternary branch)', async () => {
    writeFileSync(join(projectRoot, CODEX_MD), '# From codex.md\n');
    await importFromCodex(projectRoot);
    const root = readFileSync(join(projectRoot, '.agentsmesh/rules/_root.md'), 'utf-8');
    expect(root).toContain('# From codex.md');
  });

  it('preserves frontmatter.root when already set to true (skips spread merge)', async () => {
    writeFileSync(
      join(projectRoot, AGENTS_MD),
      '---\nroot: true\ndescription: Existing\n---\n\n# Body content\n',
    );
    await importFromCodex(projectRoot);
    const root = readFileSync(join(projectRoot, '.agentsmesh/rules/_root.md'), 'utf-8');
    expect(root).toContain('root: true');
    expect(root).toContain('description: Existing');
    expect(root).toContain('# Body content');
  });

  it('global scope does not import codex.md/AGENTS.md when only project files exist', async () => {
    writeFileSync(join(projectRoot, CODEX_MD), '# From codex.md\n');
    writeFileSync(join(projectRoot, AGENTS_MD), '# Project AGENTS.md\n');
    const results = await importFromCodex(projectRoot, { scope: 'global' });
    expect(results.find((r) => r.toPath === '.agentsmesh/rules/_root.md')).toBeUndefined();
  });
});
