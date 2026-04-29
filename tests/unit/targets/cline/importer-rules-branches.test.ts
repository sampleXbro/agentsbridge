/**
 * Branch coverage tests for cline/importer-rules.ts.
 * Targets:
 *   - .clinerules-as-flat-file with empty/null content (lines 38-46)
 *   - root frontmatter already true (line 73 / 96 / 113 short-circuit)
 *   - first-md-as-root path with non-readable / unreadable file (lines 90-114)
 *   - workflow file skipped from md scan
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

  it('preserves frontmatter.root === true on flat-file .clinerules', async () => {
    writeFileSync(
      join(projectRoot, CLINE_RULES_DIR),
      '---\nroot: true\ndescription: pre-set\n---\n\n# Body\n',
    );
    await importFromCline(projectRoot);
    const root = readFileSync(join(projectRoot, '.agentsmesh/rules/_root.md'), 'utf-8');
    expect(root).toContain('root: true');
    expect(root).toContain('description: pre-set');
  });

  it('preserves frontmatter.root === true on .clinerules/_root.md', async () => {
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

  it('skips files inside workflows/ when picking first-md as root', async () => {
    mkdirSync(join(projectRoot, CLINE_RULES_DIR, 'workflows'), { recursive: true });
    writeFileSync(
      join(projectRoot, CLINE_RULES_DIR, 'workflows', 'aaa-deploy.md'),
      'Workflow content',
    );
    writeFileSync(join(projectRoot, CLINE_RULES_DIR, 'beta.md'), 'Beta content');
    await importFromCline(projectRoot);
    const root = readFileSync(join(projectRoot, '.agentsmesh/rules/_root.md'), 'utf-8');
    // Should not have used workflows/aaa-deploy.md even though alphabetically it would sort first
    expect(root).toContain('Beta content');
  });

  it('returns empty when .clinerules dir is empty (no _root, no AGENTS.md, no md)', async () => {
    mkdirSync(join(projectRoot, CLINE_RULES_DIR), { recursive: true });
    const results = await importFromCline(projectRoot);
    expect(results.find((r) => r.toPath === '.agentsmesh/rules/_root.md')).toBeUndefined();
  });
});
