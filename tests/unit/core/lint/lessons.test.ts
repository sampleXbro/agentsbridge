import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lintLessonsSubsystem } from '../../../../src/core/lint/shared/lessons.js';

const ROOT = join(tmpdir(), 'agentsmesh-lessons-lint-test');
const LESSONS = '.agentsmesh/lessons';
const INDEX = `${LESSONS}/index.yaml`;
const TOPICS = `${LESSONS}/topics`;
const ROOT_RULE = '.agentsmesh/rules/_root.md';

function write(rel: string, body: string): void {
  const abs = join(ROOT, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, body, 'utf8');
}

function validIndex(): string {
  return [
    'version: 1',
    'clusters:',
    '  - topic: alpha',
    `    file: ${TOPICS}/alpha.md`,
    '    summary: Alpha topic.',
    '    triggers:',
    '      file_globs:',
    '        - "src/**/*.ts"',
    '      command_patterns: []',
    '      keywords: []',
    '',
  ].join('\n');
}

function validTopic(): string {
  return '# Alpha\n\n## Rules (apply unconditionally)\n\n1. Do the thing.\n';
}

function validRootRule(): string {
  return '---\nroot: true\n---\n\n# Operational Guidelines\n\n## Lessons (MUST do)\n\nbody\n';
}

beforeEach(() => mkdirSync(ROOT, { recursive: true }));
afterEach(() => rmSync(ROOT, { recursive: true, force: true }));

describe('lintLessonsSubsystem', () => {
  it('returns no diagnostics when scope is global', () => {
    write(INDEX, 'not even yaml: : :');
    expect(lintLessonsSubsystem(ROOT, 'global')).toEqual([]);
  });

  it('returns no diagnostics when index.yaml is absent (subsystem not installed)', () => {
    expect(lintLessonsSubsystem(ROOT, 'project')).toEqual([]);
  });

  it('returns no diagnostics for a healthy subsystem', () => {
    write(INDEX, validIndex());
    write(`${TOPICS}/alpha.md`, validTopic());
    write(ROOT_RULE, validRootRule());
    expect(lintLessonsSubsystem(ROOT, 'project')).toEqual([]);
  });

  it('emits an error when index.yaml fails schema validation', () => {
    write(INDEX, 'version: 99\nclusters: []\n');
    write(ROOT_RULE, validRootRule());
    const diags = lintLessonsSubsystem(ROOT, 'project');
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({
      level: 'error',
      file: INDEX,
      target: 'lessons',
    });
    expect(diags[0]!.message).toMatch(/invalid/i);
  });

  it('emits an error when a cluster references a missing topic file', () => {
    write(INDEX, validIndex());
    write(ROOT_RULE, validRootRule());
    const diags = lintLessonsSubsystem(ROOT, 'project');
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({
      level: 'error',
      file: `${TOPICS}/alpha.md`,
      target: 'lessons',
    });
    expect(diags[0]!.message).toContain('alpha');
  });

  it('emits a warning when a topic body lacks the "## Rules" heading', () => {
    write(INDEX, validIndex());
    write(`${TOPICS}/alpha.md`, '# Alpha\n\nno rules section\n');
    write(ROOT_RULE, validRootRule());
    const diags = lintLessonsSubsystem(ROOT, 'project');
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({
      level: 'warning',
      file: `${TOPICS}/alpha.md`,
      target: 'lessons',
    });
    expect(diags[0]!.message).toMatch(/## Rules/);
  });

  it('emits a warning when a command_patterns entry is not a valid regex', () => {
    const idx = validIndex().replace('command_patterns: []', 'command_patterns: ["[unclosed"]');
    write(INDEX, idx);
    write(`${TOPICS}/alpha.md`, validTopic());
    write(ROOT_RULE, validRootRule());
    const diags = lintLessonsSubsystem(ROOT, 'project');
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({
      level: 'warning',
      file: INDEX,
      target: 'lessons',
    });
    expect(diags[0]!.message).toMatch(/regex/i);
  });

  it('emits a warning when the procedural rule paragraph is missing from _root.md', () => {
    write(INDEX, validIndex());
    write(`${TOPICS}/alpha.md`, validTopic());
    write(ROOT_RULE, '---\nroot: true\n---\n\n# Operational Guidelines\n\nno lessons heading\n');
    const diags = lintLessonsSubsystem(ROOT, 'project');
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({
      level: 'warning',
      file: ROOT_RULE,
      target: 'lessons',
    });
    expect(diags[0]!.message).toMatch(/## Lessons/);
  });

  it('emits a warning when _root.md itself is absent', () => {
    write(INDEX, validIndex());
    write(`${TOPICS}/alpha.md`, validTopic());
    const diags = lintLessonsSubsystem(ROOT, 'project');
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({
      level: 'warning',
      file: ROOT_RULE,
      target: 'lessons',
    });
  });
});
