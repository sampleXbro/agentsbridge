/**
 * Branch coverage tests for cline/importer-rules.ts.
 * Targets:
 *   - root frontmatter already true (short-circuit) across all three
 *     detection tiers: `.cline/rules/_root.md`, `AGENTS.md`, first-md fallback
 *   - empty rules dir (no root candidate found at all)
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { importFromCline } from '../../../../src/targets/cline/importer.js';
import { CLINE_RULES_DIR, CLINE_AGENTS_MD } from '../../../../src/targets/cline/constants.js';

describe('importClineRules — branch coverage', () => {
  let projectRoot = '';

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'amesh-cov-'));
  });

  afterEach(() => {
    if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
    projectRoot = '';
  });

  it('preserves frontmatter.root === true on .cline/rules/_root.md', async () => {
    mkdirSync(join(projectRoot, CLINE_RULES_DIR), { recursive: true });
    writeFileSync(
      join(projectRoot, CLINE_RULES_DIR, '_root.md'),
      '---\nroot: true\ndescription: from-root\n---\n\nBody.',
    );
    await importFromCline(projectRoot);
    const root = readFileSync(join(projectRoot, '.agentsmesh/rules/_root.md'), 'utf-8');
    expect(root).toContain('description: from-root');
    expect(root).toContain('root: true');
  });

  it('preserves frontmatter.root === true on AGENTS.md fallback', async () => {
    writeFileSync(
      join(projectRoot, CLINE_AGENTS_MD),
      '---\nroot: true\ndescription: am-root\n---\n\nFrom AGENTS.md.',
    );
    await importFromCline(projectRoot);
    const root = readFileSync(join(projectRoot, '.agentsmesh/rules/_root.md'), 'utf-8');
    expect(root).toContain('description: am-root');
    expect(root).toContain('root: true');
  });

  it('preserves frontmatter.root === true on first-md fallback (no _root and no AGENTS.md)', async () => {
    mkdirSync(join(projectRoot, CLINE_RULES_DIR), { recursive: true });
    writeFileSync(
      join(projectRoot, CLINE_RULES_DIR, 'alpha.md'),
      '---\nroot: true\ndescription: from-alpha\n---\n\n# alpha body\n',
    );
    await importFromCline(projectRoot);
    const root = readFileSync(join(projectRoot, '.agentsmesh/rules/_root.md'), 'utf-8');
    expect(root).toContain('description: from-alpha');
    expect(root).toContain('root: true');
  });

  it('returns empty when .cline/rules dir is empty (no _root, no AGENTS.md, no md)', async () => {
    mkdirSync(join(projectRoot, CLINE_RULES_DIR), { recursive: true });
    const results = await importFromCline(projectRoot);
    expect(results.find((r) => r.toPath === '.agentsmesh/rules/_root.md')).toBeUndefined();
  });
});
