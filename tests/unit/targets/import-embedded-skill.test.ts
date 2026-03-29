import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  generateEmbeddedSkills,
  importEmbeddedSkills,
} from '../../../src/targets/import/embedded-skill.js';
import type { ImportResult } from '../../../src/core/result-types.js';

describe('embedded skill helpers', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'agentsmesh-embedded-skill-'));
    tempDirs.push(dir);
    return dir;
  }

  it('generates SKILL.md plus supporting files and omits empty descriptions', () => {
    const outputs = generateEmbeddedSkills(
      {
        rules: [],
        commands: [],
        agents: [],
        skills: [
          {
            source: '.agentsmesh/skills/review/SKILL.md',
            name: 'review',
            description: '',
            body: 'Review changes.',
            supportingFiles: [
              {
                relativePath: 'references\\guide.md',
                absolutePath: '/tmp/guide.md',
                content: '# Guide\n',
              },
            ],
          },
        ],
        mcp: null,
        permissions: null,
        hooks: null,
        ignore: [],
      },
      '.continue/skills',
    );

    expect(outputs).toHaveLength(2);
    expect(outputs[0]!).toMatchObject({
      path: '.continue/skills/review/SKILL.md',
    });
    expect(outputs[0]!.content).toContain('name: review');
    expect(outputs[0]!.content).not.toContain('description:');
    expect(outputs[1]!).toMatchObject({
      path: '.continue/skills/review/references/guide.md',
      content: '# Guide\n',
    });
  });

  it('returns without changes when the native skills directory is absent', async () => {
    const dir = createTempDir();
    const results: ImportResult[] = [];

    await importEmbeddedSkills(dir, '.continue/skills', 'continue', results, (content) => content);

    expect(results).toEqual([]);
  });

  it('imports embedded skills, skips non-directories, and preserves supporting files', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.continue', 'skills', 'api-gen', 'references'), { recursive: true });
    mkdirSync(join(dir, '.continue', 'skills', 'draft'), { recursive: true });
    writeFileSync(join(dir, '.continue', 'skills', 'README.md'), 'ignored');
    writeFileSync(join(dir, '.continue', 'skills', 'api-gen', 'SKILL.md'), 'Use refs/guide.md.');
    writeFileSync(
      join(dir, '.continue', 'skills', 'api-gen', 'references', 'guide.md'),
      '# Guide\n',
    );
    writeFileSync(join(dir, '.continue', 'skills', 'draft', 'notes.md'), 'no skill file');

    const results: ImportResult[] = [];
    await importEmbeddedSkills(dir, '.continue/skills', 'continue', results, (content) => content);

    expect(results.map(({ feature, toPath }) => ({ feature, toPath }))).toEqual([
      { feature: 'skills', toPath: '.agentsmesh/skills/api-gen/SKILL.md' },
      { feature: 'skills', toPath: '.agentsmesh/skills/api-gen/references/guide.md' },
    ]);
    expect(
      readFileSync(join(dir, '.agentsmesh', 'skills', 'api-gen', 'SKILL.md'), 'utf-8'),
    ).toContain('name: api-gen');
    expect(
      readFileSync(
        join(dir, '.agentsmesh', 'skills', 'api-gen', 'references', 'guide.md'),
        'utf-8',
      ),
    ).toContain('# Guide');
  });
});
