import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { importFromGoose } from '../../../../src/targets/goose/importer.js';

function setupFixture(files: Record<string, string>): string {
  const root = join(
    tmpdir(),
    `goose-import-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

describe('importFromGoose', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = '';
  });

  it('imports .goosehints as root rule', async () => {
    projectRoot = setupFixture({
      '.goosehints': '# Project Instructions\n\nUse TDD.',
    });

    const results = await importFromGoose(projectRoot);

    const rootRule = results.find((r) => r.toPath.endsWith('_root.md'));
    expect(rootRule).toBeDefined();
    expect(rootRule!.feature).toBe('rules');
    expect(rootRule!.fromTool).toBe('goose');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports .gooseignore as canonical ignore', async () => {
    projectRoot = setupFixture({
      '.gooseignore': '.env\nnode_modules/\ndist/',
    });

    const results = await importFromGoose(projectRoot);

    const ignoreResult = results.find((r) => r.feature === 'ignore');
    expect(ignoreResult).toBeDefined();
    expect(ignoreResult!.fromTool).toBe('goose');
    expect(ignoreResult!.toPath).toContain('ignore');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports skills from .agents/skills/', async () => {
    projectRoot = setupFixture({
      '.agents/skills/debugging/SKILL.md':
        '---\nname: debugging\ndescription: Debug workflow\n---\n\n# Debugging\n\nReproduce first.',
      '.agents/skills/debugging/references/checklist.md': '# Checklist\n\n- Step 1',
    });

    const results = await importFromGoose(projectRoot);

    const skillResults = results.filter((r) => r.feature === 'skills');
    expect(skillResults.length).toBeGreaterThanOrEqual(1);
    expect(skillResults[0].fromTool).toBe('goose');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('returns empty results when no goose config exists', async () => {
    projectRoot = setupFixture({});
    const results = await importFromGoose(projectRoot);
    expect(results).toHaveLength(0);

    rmSync(projectRoot, { recursive: true, force: true });
  });
});
