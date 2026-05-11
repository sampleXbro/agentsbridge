import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { importFromPiAgent } from '../../../../src/targets/pi-agent/importer.js';

function setupFixture(files: Record<string, string>): string {
  const root = join(
    tmpdir(),
    `pi-agent-import-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

describe('importFromPiAgent', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = '';
  });

  it('imports AGENTS.md as root rule', async () => {
    projectRoot = setupFixture({
      'AGENTS.md': '# Project Instructions\n\nUse TDD.',
    });

    const results = await importFromPiAgent(projectRoot);

    const rootRule = results.find((r) => r.toPath.endsWith('_root.md'));
    expect(rootRule).toBeDefined();
    expect(rootRule!.feature).toBe('rules');
    expect(rootRule!.fromTool).toBe('pi-agent');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports skills from .pi/skills/', async () => {
    projectRoot = setupFixture({
      '.pi/skills/debugging/SKILL.md':
        '---\nname: debugging\ndescription: Debug workflow\n---\n\n# Debugging\n\nReproduce first.',
      '.pi/skills/debugging/references/checklist.md': '# Checklist\n\n- Step 1',
    });

    const results = await importFromPiAgent(projectRoot);

    const skillResults = results.filter((r) => r.feature === 'skills');
    expect(skillResults.length).toBeGreaterThanOrEqual(1);
    expect(skillResults[0].fromTool).toBe('pi-agent');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('returns empty results when no pi-agent config exists', async () => {
    projectRoot = setupFixture({});
    const results = await importFromPiAgent(projectRoot);
    expect(results).toHaveLength(0);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports both AGENTS.md and skills when both exist', async () => {
    projectRoot = setupFixture({
      'AGENTS.md': '# Instructions\n\nBe thorough.',
      '.pi/skills/testing/SKILL.md':
        '---\nname: testing\ndescription: Test workflow\n---\n\n# Testing\n\nWrite tests first.',
    });

    const results = await importFromPiAgent(projectRoot);

    const ruleResults = results.filter((r) => r.feature === 'rules');
    const skillResults = results.filter((r) => r.feature === 'skills');
    expect(ruleResults.length).toBeGreaterThanOrEqual(1);
    expect(skillResults.length).toBeGreaterThanOrEqual(1);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('passes scope to the importer', async () => {
    projectRoot = setupFixture({});

    const results = await importFromPiAgent(projectRoot, { scope: 'global' });
    expect(results).toHaveLength(0);

    rmSync(projectRoot, { recursive: true, force: true });
  });
});
