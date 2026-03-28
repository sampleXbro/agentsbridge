import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { importClineSkills } from '../../../../src/targets/cline/skills-helpers.js';
import type { ImportResult } from '../../../../src/core/result-types.js';

describe('cline skill import helpers', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'agentsmesh-cline-skills-'));
    tempDirs.push(dir);
    return dir;
  }

  it('returns without importing when no Cline skills directory exists', async () => {
    const dir = createTempDir();
    const results: ImportResult[] = [];

    await importClineSkills(dir, results, (content) => content);

    expect(results).toEqual([]);
  });

  it('imports projected agent skills into canonical agents', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.cline', 'skills', 'am-agent-reviewer'), { recursive: true });
    writeFileSync(
      join(dir, '.cline', 'skills', 'am-agent-reviewer', 'SKILL.md'),
      [
        '---',
        'x-agentsmesh-kind: agent',
        'x-agentsmesh-tools: Read, Grep',
        '---',
        '',
        'Projected reviewer body.',
      ].join('\n'),
    );

    const results: ImportResult[] = [];
    await importClineSkills(dir, results, (content) => content);

    expect(results.map(({ feature, toPath }) => ({ feature, toPath }))).toEqual([
      { feature: 'agents', toPath: '.agentsmesh/agents/reviewer.md' },
    ]);
    expect(readFileSync(join(dir, '.agentsmesh', 'agents', 'reviewer.md'), 'utf-8')).toContain(
      'Projected reviewer body.',
    );
  });

  it('imports normal skills, skips nested SKILL.md support files, and preserves assets', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.cline', 'skills', 'qa', 'references'), { recursive: true });
    writeFileSync(join(dir, '.cline', 'skills', 'README.md'), 'ignored');
    writeFileSync(
      join(dir, '.cline', 'skills', 'qa', 'SKILL.md'),
      '---\ndescription: QA\n---\n\nUse references/checklist.md.',
    );
    writeFileSync(
      join(dir, '.cline', 'skills', 'qa', 'references', 'checklist.md'),
      '# Checklist\n',
    );
    writeFileSync(
      join(dir, '.cline', 'skills', 'qa', 'references', 'SKILL.md'),
      'ignored nested skill',
    );

    const results: ImportResult[] = [];
    await importClineSkills(dir, results, (content) => content);

    expect(results.map(({ feature, toPath }) => ({ feature, toPath }))).toEqual([
      { feature: 'skills', toPath: '.agentsmesh/skills/qa/SKILL.md' },
      { feature: 'skills', toPath: '.agentsmesh/skills/qa/references/checklist.md' },
    ]);
    expect(readFileSync(join(dir, '.agentsmesh', 'skills', 'qa', 'SKILL.md'), 'utf-8')).toContain(
      'description: QA',
    );
    expect(
      readFileSync(join(dir, '.agentsmesh', 'skills', 'qa', 'references', 'checklist.md'), 'utf-8'),
    ).toContain('# Checklist');
    expect(existsSync(join(dir, '.agentsmesh', 'skills', 'qa', 'references', 'SKILL.md'))).toBe(
      false,
    );
  });
});
