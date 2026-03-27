import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  importAgents,
  importSkills,
} from '../../../../src/targets/copilot/agents-skills-helpers.js';

describe('copilot agent and skill import helpers', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'agentsmesh-copilot-helpers-'));
    tempDirs.push(dir);
    return dir;
  }

  it('returns without importing agents when the native agents directory is absent', async () => {
    const dir = createTempDir();
    const results: Array<{ toPath: string }> = [];

    await importAgents(dir, results, (content) => content);

    expect(results).toEqual([]);
  });

  it('imports nested agent files and skips empty .agent.md files', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.github', 'agents', 'frontend'), { recursive: true });
    writeFileSync(
      join(dir, '.github', 'agents', 'frontend', 'reviewer.agent.md'),
      '---\ntools: Read, Grep\n---\n\nReview frontend changes.',
    );
    writeFileSync(join(dir, '.github', 'agents', 'empty.agent.md'), '');

    const results: Array<{ feature: string; toPath: string }> = [];
    await importAgents(dir, results, (content) => content);

    expect(results.map(({ feature, toPath }) => ({ feature, toPath }))).toEqual([
      { feature: 'agents', toPath: '.agentsmesh/agents/frontend/reviewer.md' },
    ]);
    expect(
      readFileSync(join(dir, '.agentsmesh', 'agents', 'frontend', 'reviewer.md'), 'utf-8'),
    ).toContain('name: reviewer');
  });

  it('imports native Copilot skills with supporting files', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.github', 'skills', 'release', 'references'), { recursive: true });
    writeFileSync(
      join(dir, '.github', 'skills', 'release', 'SKILL.md'),
      '---\ndescription: Release\n---\n\nUse references/guide.md.',
    );
    writeFileSync(join(dir, '.github', 'skills', 'release', 'references', 'guide.md'), '# Guide\n');

    const results: Array<{ feature: string; toPath: string }> = [];
    await importSkills(dir, results, (content) => content);

    expect(results.map(({ feature, toPath }) => ({ feature, toPath }))).toEqual([
      { feature: 'skills', toPath: '.agentsmesh/skills/release/SKILL.md' },
      { feature: 'skills', toPath: '.agentsmesh/skills/release/references/guide.md' },
    ]);
    expect(
      readFileSync(join(dir, '.agentsmesh', 'skills', 'release', 'SKILL.md'), 'utf-8'),
    ).toContain('description: Release');
    expect(
      existsSync(join(dir, '.agentsmesh', 'skills', 'release', 'references', 'guide.md')),
    ).toBe(true);
  });
});
