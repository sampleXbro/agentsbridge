import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { importFromAider } from '../../../../src/targets/aider/importer.js';

function setupFixture(files: Record<string, string>): string {
  const root = join(
    tmpdir(),
    `aider-import-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

describe('importFromAider', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = '';
  });

  it('imports CONVENTIONS.md as root rule', async () => {
    projectRoot = setupFixture({
      'CONVENTIONS.md': '# Project Instructions\n\nUse TDD.',
    });

    const results = await importFromAider(projectRoot);

    const rootRule = results.find((r) => r.toPath.endsWith('_root.md'));
    expect(rootRule).toBeDefined();
    expect(rootRule!.feature).toBe('rules');
    expect(rootRule!.fromTool).toBe('aider');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports .aiderignore as canonical ignore', async () => {
    projectRoot = setupFixture({
      '.aiderignore': '.env\nnode_modules/\ndist/',
    });

    const results = await importFromAider(projectRoot);

    const ignoreResult = results.find((r) => r.feature === 'ignore');
    expect(ignoreResult).toBeDefined();
    expect(ignoreResult!.fromTool).toBe('aider');
    expect(ignoreResult!.toPath).toContain('ignore');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports skills from .aider/skills/', async () => {
    projectRoot = setupFixture({
      '.aider/skills/debugging/SKILL.md':
        '---\nname: debugging\ndescription: Debug workflow\n---\n\n# Debugging\n\nReproduce first.',
    });

    const results = await importFromAider(projectRoot);

    const skillResults = results.filter((r) => r.feature === 'skills');
    expect(skillResults.length).toBeGreaterThanOrEqual(1);
    expect(skillResults[0].fromTool).toBe('aider');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports .aider.conf.yml hook keys as canonical hooks', async () => {
    projectRoot = setupFixture({ '.aider.conf.yml': 'lint-cmd: ruff check\n' });

    const results = await importFromAider(projectRoot);

    expect(results.filter((r) => r.feature === 'hooks')).toEqual([
      {
        fromTool: 'aider',
        fromPath: join(projectRoot, '.aider.conf.yml'),
        toPath: '.agentsmesh/hooks.yaml',
        feature: 'hooks',
      },
    ]);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports global-scope skills and hook keys from the home layout', async () => {
    projectRoot = setupFixture({
      '.aider.conf.yml': 'notifications-command: notify\n',
      '.aider/skills/debugging/SKILL.md':
        '---\nname: debugging\ndescription: Debug workflow\n---\n\n# Debugging',
    });

    const results = await importFromAider(projectRoot, { scope: 'global' });

    expect(results.map((r) => r.feature).sort()).toEqual(['hooks', 'skills']);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('returns empty results when no aider config exists', async () => {
    projectRoot = setupFixture({});
    const results = await importFromAider(projectRoot);
    expect(results).toHaveLength(0);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('defaults to project scope when no scope option is passed', async () => {
    projectRoot = setupFixture({
      'CONVENTIONS.md': '# Project Instructions\n\nUse TDD.',
    });

    const withoutScope = await importFromAider(projectRoot);
    const withProjectScope = await importFromAider(projectRoot, { scope: 'project' });

    expect(withoutScope).toHaveLength(withProjectScope.length);
    for (let i = 0; i < withoutScope.length; i++) {
      expect(withoutScope[i].toPath).toBe(withProjectScope[i].toPath);
      expect(withoutScope[i].feature).toBe(withProjectScope[i].feature);
    }

    rmSync(projectRoot, { recursive: true, force: true });
  });
});
