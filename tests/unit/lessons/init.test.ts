import { describe, it, expect, beforeEach } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scaffoldLessons } from '../../../src/lessons/init.js';
import { lessonsPaths } from '../../../src/lessons/paths.js';

let projectRoot: string;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'lessons-init-'));
});

describe('scaffoldLessons', () => {
  it('creates journal, index, topics dir, and root rule with procedural paragraph', () => {
    const result = scaffoldLessons(projectRoot);
    const paths = lessonsPaths(projectRoot);

    expect(existsSync(paths.journal)).toBe(true);
    expect(existsSync(paths.index)).toBe(true);
    expect(existsSync(paths.topicsDir)).toBe(true);
    expect(readFileSync(paths.journal, 'utf8')).toMatch(/^# /);
    expect(readFileSync(paths.index, 'utf8')).toContain('clusters: []');

    const rootRule = readFileSync(join(projectRoot, '.agentsmesh/rules/_root.md'), 'utf8');
    expect(rootRule).toContain('## Lessons (mandatory)');

    expect(result.created.length).toBeGreaterThan(0);
    expect(result.rootRuleUpdated).toBe(true);
  });

  it('is idempotent — re-running does not duplicate the procedural paragraph', () => {
    scaffoldLessons(projectRoot);
    const second = scaffoldLessons(projectRoot);

    const rootRule = readFileSync(join(projectRoot, '.agentsmesh/rules/_root.md'), 'utf8');
    const occurrences = rootRule.match(/## Lessons \(mandatory\)/g) ?? [];
    expect(occurrences.length).toBe(1);

    expect(second.skipped.length).toBeGreaterThan(0);
    expect(second.rootRuleUpdated).toBe(false);
  });

  it('appends procedural rule to an existing root rule file without overwriting other content', () => {
    const customRule = `---\nroot: true\ndescription: ""\n---\n\n# Operational Guidelines\n\n## Custom Section\n\nKeep me intact.\n`;
    mkdirSync(join(projectRoot, '.agentsmesh/rules'), { recursive: true });
    writeFileSync(join(projectRoot, '.agentsmesh/rules/_root.md'), customRule, 'utf8');

    scaffoldLessons(projectRoot);

    const rootRule = readFileSync(join(projectRoot, '.agentsmesh/rules/_root.md'), 'utf8');
    expect(rootRule).toContain('## Custom Section');
    expect(rootRule).toContain('Keep me intact.');
    expect(rootRule).toContain('## Lessons (mandatory)');
  });

  it('normalizes append when existing root rule does not end with a newline', () => {
    const noTrailingNewline = `---\nroot: true\ndescription: ""\n---\n\n# Operational Guidelines\n\n## Custom Section\n\nLast line no newline`;
    mkdirSync(join(projectRoot, '.agentsmesh/rules'), { recursive: true });
    writeFileSync(join(projectRoot, '.agentsmesh/rules/_root.md'), noTrailingNewline, 'utf8');

    scaffoldLessons(projectRoot);

    const rootRule = readFileSync(join(projectRoot, '.agentsmesh/rules/_root.md'), 'utf8');
    expect(rootRule).toMatch(/Last line no newline\n+## Lessons \(mandatory\)/);
    expect(rootRule.endsWith('\n')).toBe(true);
  });
});
