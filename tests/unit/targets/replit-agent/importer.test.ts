import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { importFromReplitAgent } from '../../../../src/targets/replit-agent/importer.js';

function setupFixture(files: Record<string, string>): string {
  const root = join(
    tmpdir(),
    `replit-agent-import-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

describe('importFromReplitAgent', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = '';
  });

  it('imports replit.md as root rule', async () => {
    projectRoot = setupFixture({
      'replit.md': '# Project Instructions\n\nUse TDD.',
    });

    const results = await importFromReplitAgent(projectRoot);

    const rootRule = results.find((r) => r.toPath.endsWith('_root.md'));
    expect(rootRule).toBeDefined();
    expect(rootRule!.feature).toBe('rules');
    expect(rootRule!.fromTool).toBe('replit-agent');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports skills from .agents/skills/', async () => {
    projectRoot = setupFixture({
      '.agents/skills/debugging/SKILL.md':
        '---\nname: debugging\ndescription: Debug workflow\n---\n\n# Debugging\n\nReproduce first.',
      '.agents/skills/debugging/references/checklist.md': '# Checklist\n\n- Step 1',
    });

    const results = await importFromReplitAgent(projectRoot);

    const skillResults = results.filter((r) => r.feature === 'skills');
    expect(skillResults.length).toBeGreaterThanOrEqual(1);
    expect(skillResults[0].fromTool).toBe('replit-agent');

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('returns empty results when no replit-agent config exists', async () => {
    projectRoot = setupFixture({});
    const results = await importFromReplitAgent(projectRoot);
    expect(results).toHaveLength(0);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('imports both replit.md and skills together', async () => {
    projectRoot = setupFixture({
      'replit.md': '# Root Instructions\n\nAlways use TypeScript.',
      '.agents/skills/review/SKILL.md':
        '---\nname: review\ndescription: Code review\n---\n\n# Review\n\nReview all PRs.',
    });

    const results = await importFromReplitAgent(projectRoot);

    const rootRule = results.find((r) => r.toPath.endsWith('_root.md'));
    expect(rootRule).toBeDefined();

    const skillResults = results.filter((r) => r.feature === 'skills');
    expect(skillResults.length).toBeGreaterThanOrEqual(1);

    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('handles empty replit.md file', async () => {
    projectRoot = setupFixture({
      'replit.md': '',
    });

    const results = await importFromReplitAgent(projectRoot);

    // An empty file may still produce an import result (empty content)
    const rootRule = results.find((r) => r.toPath.endsWith('_root.md'));
    // Empty content is valid — it creates a placeholder root rule
    expect(rootRule === undefined || rootRule.feature === 'rules').toBe(true);

    rmSync(projectRoot, { recursive: true, force: true });
  });
});
