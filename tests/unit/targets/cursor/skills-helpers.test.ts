import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { importSkills } from '../../../../src/targets/cursor/skills-helpers.js';
import type { ImportResult } from '../../../../src/core/result-types.js';

describe('cursor skill import helpers', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'agentsmesh-cursor-skills-'));
    tempDirs.push(dir);
    return dir;
  }

  it('returns without importing when no Cursor skills directory exists', async () => {
    const dir = createTempDir();
    const results: ImportResult[] = [];

    await importSkills(dir, results, (content) => content);

    expect(results).toEqual([]);
  });

  it('imports both structured and flat Cursor skills while skipping empty flat files', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.cursor', 'skills', 'review', 'docs'), { recursive: true });
    writeFileSync(
      join(dir, '.cursor', 'skills', 'review', 'SKILL.md'),
      '---\ndescription: Review\n---\n\nUse docs/checklist.md.',
    );
    writeFileSync(
      join(dir, '.cursor', 'skills', 'review', 'docs', 'checklist.md'),
      '# Checklist\n',
    );
    writeFileSync(join(dir, '.cursor', 'skills', 'qa.md'), 'QA body.');
    writeFileSync(join(dir, '.cursor', 'skills', 'empty.md'), '');

    const results: ImportResult[] = [];
    await importSkills(dir, results, (content) => content);

    expect(results.map(({ feature, toPath }) => ({ feature, toPath }))).toEqual([
      { feature: 'skills', toPath: '.agentsmesh/skills/review/SKILL.md' },
      { feature: 'skills', toPath: '.agentsmesh/skills/review/docs/checklist.md' },
      { feature: 'skills', toPath: '.agentsmesh/skills/qa/SKILL.md' },
    ]);
    expect(
      readFileSync(join(dir, '.agentsmesh', 'skills', 'review', 'SKILL.md'), 'utf-8'),
    ).toContain('description: Review');
    expect(readFileSync(join(dir, '.agentsmesh', 'skills', 'qa', 'SKILL.md'), 'utf-8')).toContain(
      'name: qa',
    );
  });

  it('imports skills from an alternate relative directory (global export tree)', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.agentsmesh-exports', 'cursor', 'skills', 'demo'), { recursive: true });
    writeFileSync(
      join(dir, '.agentsmesh-exports', 'cursor', 'skills', 'demo', 'SKILL.md'),
      '---\ndescription: Demo\n---\n\nBody.',
    );
    const results: ImportResult[] = [];
    await importSkills(dir, results, (content) => content, '.agentsmesh-exports/cursor/skills');

    expect(results).toHaveLength(1);
    expect(readFileSync(join(dir, '.agentsmesh', 'skills', 'demo', 'SKILL.md'), 'utf-8')).toContain(
      'Body.',
    );
  });
});
