import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importCursorRootFile } from '../../../../src/targets/cursor/import-root-helpers.js';
import type { ImportResult } from '../../../../src/core/types.js';

let projectRoot = '';

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'amesh-cursor-root-'));
});

afterEach(() => {
  if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
  projectRoot = '';
});

const noopNormalize = (content: string): string => content;

describe('importCursorRootFile — uncovered branches', () => {
  it('persists root with frontmatter root=true preserved when present', async () => {
    const sourcePath = join(projectRoot, '.cursor', 'rules', '_root.mdc');
    mkdirSync(join(projectRoot, '.cursor', 'rules'), { recursive: true });
    writeFileSync(sourcePath, '---\nroot: true\n---\n# Root body\n');
    const results: ImportResult[] = [];
    await importCursorRootFile({
      projectRoot,
      results,
      sourcePath,
      content: '---\nroot: true\n---\n# Root body\n',
      normalize: noopNormalize,
    });
    const out = readFileSync(join(projectRoot, '.agentsmesh/rules/_root.md'), 'utf-8');
    expect(out).toContain('root: true');
    expect(out).toContain('# Root body');
    expect(results).toHaveLength(1);
  });

  it('adds root=true when frontmatter does not have it', async () => {
    const sourcePath = join(projectRoot, '.cursor', 'rules', '_root.mdc');
    mkdirSync(join(projectRoot, '.cursor', 'rules'), { recursive: true });
    writeFileSync(sourcePath, '---\ndescription: x\n---\n# Body\n');
    const results: ImportResult[] = [];
    await importCursorRootFile({
      projectRoot,
      results,
      sourcePath,
      content: '---\ndescription: x\n---\n# Body\n',
      normalize: noopNormalize,
    });
    const out = readFileSync(join(projectRoot, '.agentsmesh/rules/_root.md'), 'utf-8');
    expect(out).toContain('root: true');
    expect(out).toContain('description: x');
  });

  it('returns true without writing when normalized root is empty AND embedded rules were extracted', async () => {
    // Create a content that has only embedded rules markers; after stripping them,
    // the body trims to empty. splitEmbeddedRulesToCanonical should populate split.results.
    const embeddedContent = `<!-- agentsmesh:embedded-rules:start -->
<!-- agentsmesh:embedded-rule:start {"source":"rules/foo.md","description":"d","globs":[],"targets":[]} -->
foo body
<!-- agentsmesh:embedded-rule:end -->
<!-- agentsmesh:embedded-rules:end -->`;
    const sourcePath = join(projectRoot, '.cursor', 'rules', '_root.mdc');
    mkdirSync(join(projectRoot, '.cursor', 'rules'), { recursive: true });
    writeFileSync(sourcePath, embeddedContent);
    const results: ImportResult[] = [];
    const out = await importCursorRootFile({
      projectRoot,
      results,
      sourcePath,
      content: embeddedContent,
      normalize: noopNormalize,
    });
    expect(out).toBe(true);
  });
});
