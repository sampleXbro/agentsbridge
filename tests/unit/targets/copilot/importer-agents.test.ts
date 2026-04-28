/**
 * Copilot agent import behavior — exercised through the descriptor-driven
 * runner. The legacy `importAgents` helper was deleted when copilot's
 * `.agent.md` import moved into `descriptor.importer.agents`; this suite
 * pins the same contract on the new path.
 */

import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { runDescriptorImport } from '../../../../src/targets/import/descriptor-import-runner.js';
import { descriptor } from '../../../../src/targets/copilot/index.js';

describe('copilot agent import (descriptor-driven)', () => {
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

  it('returns no agent results when the native agents directory is absent', async () => {
    const dir = createTempDir();
    const results = await runDescriptorImport(descriptor, dir, 'project', {
      normalize: (content) => content,
    });
    expect(results.filter((r) => r.feature === 'agents')).toEqual([]);
  });

  it('imports nested .agent.md files and skips empties', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.github', 'agents', 'frontend'), { recursive: true });
    writeFileSync(
      join(dir, '.github', 'agents', 'frontend', 'reviewer.agent.md'),
      '---\ntools: Read, Grep\n---\n\nReview frontend changes.',
    );
    writeFileSync(join(dir, '.github', 'agents', 'empty.agent.md'), '');

    const results = await runDescriptorImport(descriptor, dir, 'project', {
      normalize: (content) => content,
    });
    const agentResults = results
      .filter((r) => r.feature === 'agents')
      .map(({ feature, toPath }) => ({ feature, toPath }));

    expect(agentResults).toEqual([
      { feature: 'agents', toPath: '.agentsmesh/agents/frontend/reviewer.md' },
    ]);
    expect(
      readFileSync(join(dir, '.agentsmesh', 'agents', 'frontend', 'reviewer.md'), 'utf-8'),
    ).toContain('name: reviewer');
  });
});
