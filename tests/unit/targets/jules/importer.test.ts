import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { importFromJules } from '../../../../src/targets/jules/importer.js';

function setupFixture(files: Record<string, string>): string {
  const root = join(
    tmpdir(),
    `jules-import-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(root, { recursive: true });
  mkdirSync(join(root, '.agentsmesh'), { recursive: true });
  for (const [relativePath, content] of Object.entries(files)) {
    const absPath = join(root, relativePath);
    mkdirSync(join(absPath, '..'), { recursive: true });
    writeFileSync(absPath, content, 'utf-8');
  }
  return root;
}

describe('importFromJules', () => {
  it('imports AGENTS.md as root rule', async () => {
    const projectRoot = setupFixture({
      'AGENTS.md': '# Project Instructions\n\nUse TDD.',
    });

    const results = await importFromJules(projectRoot);

    const rootRule = results.find((r) => r.toPath.endsWith('_root.md'));
    expect(rootRule).toBeDefined();
    expect(rootRule!.feature).toBe('rules');
    expect(rootRule!.fromTool).toBe('jules');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('returns empty results when no jules config exists', async () => {
    const projectRoot = setupFixture({});
    const results = await importFromJules(projectRoot);
    expect(results).toHaveLength(0);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports from AGENTS.md with markdown content', async () => {
    const projectRoot = setupFixture({
      'AGENTS.md': '# Coding Standards\n\n- Use TypeScript strict mode\n- Write tests first',
    });

    const results = await importFromJules(projectRoot);

    expect(results.length).toBeGreaterThanOrEqual(1);
    const rootRule = results.find((r) => r.toPath.endsWith('_root.md'));
    expect(rootRule).toBeDefined();
    expect(rootRule!.fromPath).toMatch(/AGENTS\.md$/);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports empty AGENTS.md as root rule', async () => {
    const projectRoot = setupFixture({
      'AGENTS.md': '',
    });

    const results = await importFromJules(projectRoot);

    // Empty file is still imported — the descriptor importer reads
    // the file and creates a result with empty content
    expect(results).toHaveLength(1);
    expect(results[0].fromTool).toBe('jules');
    expect(results[0].feature).toBe('rules');

    rmSync(projectRoot, { recursive: true, force: true });
  });
});
