import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/commands/init.js';
import { lessonsPaths } from '../../src/lessons/paths.js';

let projectRoot: string;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'init-lessons-'));
});

describe('runInit --lessons', () => {
  it('initializes a fresh project AND scaffolds the lessons subsystem in one shot', async () => {
    const result = await runInit(projectRoot, { lessons: true });
    expect(result.exitCode).toBe(0);

    expect(existsSync(join(projectRoot, 'agentsmesh.yaml'))).toBe(true);
    expect(existsSync(join(projectRoot, 'agentsmesh.local.yaml'))).toBe(true);

    const paths = lessonsPaths(projectRoot);
    expect(existsSync(paths.journal)).toBe(true);
    expect(existsSync(paths.index)).toBe(true);
    expect(existsSync(paths.topicsDir)).toBe(true);

    const rootRule = readFileSync(join(projectRoot, '.agentsmesh/rules/_root.md'), 'utf8');
    expect(rootRule).toContain('## Lessons (MUST do — non-negotiable)');

    expect(result.data.lessons).toBeDefined();
    expect(result.data.lessons!.rootRuleUpdated).toBe(true);
    expect(result.data.lessonsOnly).toBeUndefined();
  });

  it('retrofits the lessons subsystem on an already-initialized project (lessons-only)', async () => {
    // Simulate prior init
    mkdirSync(join(projectRoot, '.agentsmesh/rules'), { recursive: true });
    writeFileSync(join(projectRoot, 'agentsmesh.yaml'), 'version: 1\n', 'utf8');
    writeFileSync(
      join(projectRoot, '.agentsmesh/rules/_root.md'),
      '---\nroot: true\ndescription: ""\n---\n\n# Existing\n\n## Custom Section\n\nKeep me.\n',
      'utf8',
    );

    const result = await runInit(projectRoot, { lessons: true });
    expect(result.exitCode).toBe(0);
    expect(result.data.lessonsOnly).toBe(true);

    const paths = lessonsPaths(projectRoot);
    expect(existsSync(paths.journal)).toBe(true);
    expect(existsSync(paths.index)).toBe(true);

    const rootRule = readFileSync(join(projectRoot, '.agentsmesh/rules/_root.md'), 'utf8');
    expect(rootRule).toContain('## Custom Section');
    expect(rootRule).toContain('Keep me.');
    expect(rootRule).toContain('## Lessons (MUST do — non-negotiable)');
  });

  it('is idempotent — re-running --lessons on a project that already has lessons leaves files intact', async () => {
    await runInit(projectRoot, { lessons: true });
    const result = await runInit(projectRoot, { lessons: true });

    expect(result.exitCode).toBe(0);
    expect(result.data.lessonsOnly).toBe(true);
    expect(result.data.lessons!.rootRuleUpdated).toBe(false);

    const rootRule = readFileSync(join(projectRoot, '.agentsmesh/rules/_root.md'), 'utf8');
    const occurrences = rootRule.match(/^## Lessons \(/gm) ?? [];
    expect(occurrences.length).toBe(1);
  });

  it('still errors on bare init (no --lessons) when project is already initialized', async () => {
    writeFileSync(join(projectRoot, 'agentsmesh.yaml'), 'version: 1\n', 'utf8');
    await expect(runInit(projectRoot, {})).rejects.toThrow(/Already initialized/);
  });

  it('rejects --lessons + --global combination', async () => {
    await expect(runInit(projectRoot, { lessons: true, global: true })).rejects.toThrow(
      /project-mode only/i,
    );
  });
});
