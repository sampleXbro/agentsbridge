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
    expect(rootRule).toContain('## Lessons (BLOCKING REQUIREMENT');

    // No legacy artifacts.
    expect(existsSync(paths.journal)).toBe(false);
    expect(existsSync(paths.index)).toBe(false);
    expect(existsSync(paths.topicsDir)).toBe(false);

    const skillPath = join(projectRoot, '.agentsmesh/skills/lessons/SKILL.md');
    expect(result.created).toEqual([paths.graph, skillPath]);
    expect(result.rootRuleUpdated).toBe(true);
  });

  it('seeds the Tier-2 lessons skill with canonical frontmatter', async () => {
    await scaffoldLessons(projectRoot);
    const skillPath = join(projectRoot, '.agentsmesh/skills/lessons/SKILL.md');
    expect(existsSync(skillPath)).toBe(true);
    const content = readFileSync(skillPath, 'utf8');
    expect(content.startsWith('---\nname: lessons\n')).toBe(true);
    // The manual enumerates the full command surface (compact list).
    expect(content).toContain('agentsmesh lessons query');
    expect(content).toMatch(/\bimport-md\b/);
  });

  it('is idempotent — re-running keeps a single block and reports graph + skill skipped', async () => {
    await scaffoldLessons(projectRoot);
    const second = await scaffoldLessons(projectRoot);

    const rootRule = readFileSync(join(projectRoot, '.agentsmesh/rules/_root.md'), 'utf8');
    const starts = rootRule.match(/<!-- agentsmesh:lessons-contract:start -->/g) ?? [];
    expect(starts.length).toBe(1);

    const skillPath = join(projectRoot, '.agentsmesh/skills/lessons/SKILL.md');
    expect(second.created).toEqual([]);
    expect(second.skipped).toEqual([lessonsPaths(projectRoot).graph, skillPath]);
    expect(second.rootRuleUpdated).toBe(false);
  });

  it('never clobbers a user-authored lessons skill — create-if-missing preserves content', async () => {
    const skillPath = join(projectRoot, '.agentsmesh/skills/lessons/SKILL.md');
    mkdirSync(join(projectRoot, '.agentsmesh/skills/lessons'), { recursive: true });
    const custom = '---\nname: lessons\ndescription: my own manual\n---\n\nCustom body.\n';
    writeFileSync(skillPath, custom, 'utf8');

    const result = await scaffoldLessons(projectRoot);

    expect(readFileSync(skillPath, 'utf8')).toBe(custom);
    expect(result.skipped).toContain(skillPath);
    expect(result.created).not.toContain(skillPath);
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
