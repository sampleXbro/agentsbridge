/**
 * Native `.antigravityignore` (GAP 4). Project scope only — no home-directory
 * ignore file is documented, so global generation stays suppressed.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { generateIgnore } from '../../../../src/targets/antigravity/generator.js';
import { importFromAntigravity } from '../../../../src/targets/antigravity/importer.js';
import { getTargetLayout } from '../../../../src/targets/catalog/builtin-targets.js';
import { parseIgnore } from '../../../../src/canonical/features/ignore.js';
import { ANTIGRAVITY_IGNORE_FILE } from '../../../../src/targets/antigravity/constants.js';

const TEST_DIR = join(tmpdir(), 'am-antigravity-ignore-test');

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

describe('generateIgnore (antigravity)', () => {
  it('writes .antigravityignore at the workspace root, one pattern per line', () => {
    const results = generateIgnore(
      makeCanonical({ ignore: ['dist/', 'node_modules/', '!keep.md'] }),
    );
    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe('.antigravityignore');
    expect(results[0]!.content).toBe('dist/\nnode_modules/\n!keep.md');
  });

  it('returns [] when canonical has no ignore patterns so the stale file is removed', () => {
    expect(generateIgnore(makeCanonical())).toEqual([]);
  });
});

describe('antigravity ignore scoping', () => {
  it('lists .antigravityignore as a project managed output so revocation deletes it', () => {
    const layout = getTargetLayout('antigravity', 'project')!;
    expect(layout.managedOutputs!.files).toContain(ANTIGRAVITY_IGNORE_FILE);
  });

  it('suppresses .antigravityignore in global scope (no documented home-dir file)', () => {
    const layout = getTargetLayout('antigravity', 'global')!;
    expect(layout.rewriteGeneratedPath!(ANTIGRAVITY_IGNORE_FILE)).toBeNull();
  });
});

describe('importFromAntigravity — ignore', () => {
  beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

  it('copies .antigravityignore verbatim into .agentsmesh/ignore', async () => {
    writeFileSync(
      join(TEST_DIR, ANTIGRAVITY_IGNORE_FILE),
      '# build output\ndist/\n!dist/keep.txt\n',
    );

    const results = await importFromAntigravity(TEST_DIR);
    const ignore = results.filter((r) => r.feature === 'ignore');
    expect(ignore).toHaveLength(1);
    expect(ignore[0]!.toPath).toBe('.agentsmesh/ignore');
    expect(readFileSync(join(TEST_DIR, '.agentsmesh', 'ignore'), 'utf-8')).toBe(
      '# build output\ndist/\n!dist/keep.txt',
    );
  });

  /**
   * Composed loop, not each half in isolation: import keeps the file verbatim,
   * but `parseIgnore` strips comments and blank lines when canonical is loaded,
   * so regenerating returns patterns only. That loss is in the canonical ignore
   * model (a `string[]`), shared with every other ignore-capable target — it is
   * not something this target can hold on to.
   */
  it('keeps patterns and negations but not comments across import -> load -> generate', async () => {
    writeFileSync(
      join(TEST_DIR, ANTIGRAVITY_IGNORE_FILE),
      '# build output\n\ndist/\n!dist/keep.txt\n',
    );

    await importFromAntigravity(TEST_DIR);
    const canonical = makeCanonical({
      ignore: await parseIgnore(join(TEST_DIR, '.agentsmesh', 'ignore')),
    });

    expect(generateIgnore(canonical)[0]!.content).toBe('dist/\n!dist/keep.txt');
  });

  it('does not read the workspace ignore file in global scope', async () => {
    writeFileSync(join(TEST_DIR, ANTIGRAVITY_IGNORE_FILE), 'dist/\n');
    const results = await importFromAntigravity(TEST_DIR, { scope: 'global' });
    expect(results.filter((r) => r.feature === 'ignore')).toEqual([]);
  });
});
