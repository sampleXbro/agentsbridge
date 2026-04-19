import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { importAgents } from '../../../../src/targets/copilot/agents-skills-helpers.js';
import type { ImportResult } from '../../../../src/core/result-types.js';

describe('copilot agent import helpers', () => {
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
    const results: ImportResult[] = [];

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

    const results: ImportResult[] = [];
    await importAgents(dir, results, (content) => content);

    expect(results.map(({ feature, toPath }) => ({ feature, toPath }))).toEqual([
      { feature: 'agents', toPath: '.agentsmesh/agents/frontend/reviewer.md' },
    ]);
    expect(
      readFileSync(join(dir, '.agentsmesh', 'agents', 'frontend', 'reviewer.md'), 'utf-8'),
    ).toContain('name: reviewer');
  });
});
