import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scaffoldLessons } from '../../../src/lessons/init.js';
import { lessonsPaths } from '../../../src/lessons/paths.js';

let projectRoot: string;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'lessons-init-'));
});

describe('scaffoldLessons', async () => {
  it('creates lessons.json and injects the managed ritual block into _root.md', async () => {
    const result = await scaffoldLessons(projectRoot);
    const paths = lessonsPaths(projectRoot);

    expect(existsSync(paths.graph)).toBe(true);
    const graph = JSON.parse(readFileSync(paths.graph, 'utf8')) as Record<string, unknown>;
    expect(graph).toEqual({ lessons: {}, topics: {}, triggers: {}, version: 1 });

    const rootRule = readFileSync(join(projectRoot, '.agentsmesh/rules/_root.md'), 'utf8');
    expect(rootRule).toContain('<!-- agentsmesh:lessons-contract:start -->');
    expect(rootRule).toContain('<!-- agentsmesh:lessons-contract:end -->');
    expect(rootRule).toContain('## Lessons (BLOCKING REQUIREMENT — MUST run, no exceptions)');

    // No legacy artifacts.
    expect(existsSync(paths.journal)).toBe(false);
    expect(existsSync(paths.index)).toBe(false);
    expect(existsSync(paths.topicsDir)).toBe(false);

    expect(result.created).toEqual([paths.graph]);
    expect(result.rootRuleUpdated).toBe(true);
  });

  it('is idempotent — re-running keeps a single block and reports graph skipped', async () => {
    await scaffoldLessons(projectRoot);
    const second = await scaffoldLessons(projectRoot);

    const rootRule = readFileSync(join(projectRoot, '.agentsmesh/rules/_root.md'), 'utf8');
    const starts = rootRule.match(/<!-- agentsmesh:lessons-contract:start -->/g) ?? [];
    expect(starts.length).toBe(1);

    expect(second.created).toEqual([]);
    expect(second.skipped).toEqual([lessonsPaths(projectRoot).graph]);
    expect(second.rootRuleUpdated).toBe(false);
  });

  it('appends the block to an existing root rule without disturbing other content', async () => {
    mkdirSync(join(projectRoot, '.agentsmesh/rules'), { recursive: true });
    writeFileSync(
      join(projectRoot, '.agentsmesh/rules/_root.md'),
      '---\nroot: true\ndescription: ""\n---\n\n# Existing\n\n## Custom Section\n\nKeep me.\n',
      'utf8',
    );

    await scaffoldLessons(projectRoot);

    const rootRule = readFileSync(join(projectRoot, '.agentsmesh/rules/_root.md'), 'utf8');
    expect(rootRule).toContain('## Custom Section');
    expect(rootRule).toContain('Keep me.');
    expect(rootRule).toContain('<!-- agentsmesh:lessons-contract:start -->');
  });
});
