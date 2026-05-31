import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  appendLessonToJournal,
  formatLessonBullet,
  loadLessonsIndex,
  readTriggeredLessons,
} from '../../../src/lessons/store.js';
import { lessonsPaths } from '../../../src/lessons/paths.js';

let projectRoot: string;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'lessons-store-'));
  const paths = lessonsPaths(projectRoot);
  mkdirSync(paths.topicsDir, { recursive: true });
  writeFileSync(
    paths.index,
    `version: 1
clusters:
  - topic: path-safety
    file: .agentsmesh/lessons/topics/path-safety.md
    summary: Path safety rules.
    triggers:
      file_globs:
        - "src/**/*.ts"
      command_patterns: []
      keywords: []
  - topic: shell-quoting
    file: .agentsmesh/lessons/topics/shell-quoting.md
    summary: Shell quoting rules.
    triggers:
      file_globs: []
      command_patterns:
        - "^rg "
      keywords:
        - shell
  - topic: unmatched
    file: .agentsmesh/lessons/topics/unmatched.md
    summary: This topic file is intentionally absent.
    triggers:
      file_globs:
        - "src/unmatched.ts"
      command_patterns: []
      keywords: []
`,
    'utf8',
  );
  writeFileSync(
    join(paths.topicsDir, 'path-safety.md'),
    '# Lessons: path safety\n\n## Rules\n\n1. Normalize tool paths.\n',
    'utf8',
  );
  writeFileSync(
    join(paths.topicsDir, 'shell-quoting.md'),
    '# Lessons: shell quoting\n\n## Rules\n\n1. Quote carefully.\n',
    'utf8',
  );
});

function writeSingleClusterIndex(file: string): void {
  const quotedFile = file.includes('\\') ? `'${file}'` : file;
  writeFileSync(
    lessonsPaths(projectRoot).index,
    `version: 1
clusters:
  - topic: invalid
    file: ${quotedFile}
    summary: Bad path.
    triggers:
      file_globs: []
      command_patterns:
        - ".*"
      keywords: []
`,
    'utf8',
  );
}

describe('lessons store', () => {
  it('loads and validates the project lessons index from the canonical location', () => {
    const index = loadLessonsIndex(projectRoot);
    expect(index.version).toBe(1);
    expect(index.clusters.map((cluster) => cluster.topic)).toEqual([
      'path-safety',
      'shell-quoting',
      'unmatched',
    ]);
  });

  it('reads only topic files whose triggers match the tool event', () => {
    const lessons = readTriggeredLessons(projectRoot, { kind: 'bash', command: "rg 'foo' src" });
    expect(lessons).toHaveLength(1);
    expect(lessons[0]?.cluster.topic).toBe('shell-quoting');
    expect(lessons[0]?.relativePath).toBe('.agentsmesh/lessons/topics/shell-quoting.md');
    expect(lessons[0]?.content).toContain('Quote carefully');
  });

  it('normalizes absolute tool paths to project-relative POSIX paths before matching', () => {
    const lessons = readTriggeredLessons(projectRoot, {
      kind: 'edit',
      filePath: join(projectRoot, 'src/utils/path-helpers.ts'),
    });
    expect(lessons.map((lesson) => lesson.cluster.topic)).toEqual(['path-safety']);
  });

  it('normalizes backslash tool paths before matching POSIX globs', () => {
    const lessons = readTriggeredLessons(projectRoot, {
      kind: 'write',
      filePath: 'src\\utils\\path-helpers.ts',
    });
    expect(lessons.map((lesson) => lesson.cluster.topic)).toEqual(['path-safety']);
  });

  it.each([
    ['topic paths that escape the project root', '../outside.md', /project root/],
    [
      'Windows absolute topic paths on every platform',
      'C:\\outside\\lesson.md',
      /project-relative/,
    ],
  ] as const)('rejects %s', (_name, file, error) => {
    writeSingleClusterIndex(file);
    expect(() => readTriggeredLessons(projectRoot, { kind: 'bash', command: 'anything' })).toThrow(
      error,
    );
  });

  it('formats capture bullets in the universal journal shape', () => {
    expect(
      formatLessonBullet({
        heading: 'Dash-leading rg pattern',
        whatWentWrong: 'ripgrep parsed the search text as a flag',
        rootCause: 'the pattern started with -- and was passed positionally',
        rule: 'pass dash-leading patterns with -e',
      }),
    ).toBe(
      '- **Dash-leading rg pattern**: ripgrep parsed the search text as a flag. the pattern started with -- and was passed positionally. pass dash-leading patterns with -e.',
    );
  });

  it('appends formatted capture bullets to the canonical journal without overwriting content', () => {
    const paths = lessonsPaths(projectRoot);
    writeFileSync(paths.journal, '# Lessons Learned\n\n', 'utf8');

    const result = appendLessonToJournal(projectRoot, {
      heading: 'Path discovery',
      whatWentWrong: 'read used a guessed filename',
      rootCause: 'the discovered path was ignored',
      rule: 'copy the exact discovered path into the next read',
    });

    expect(result.journalPath).toBe(paths.journal);
    expect(result.lineNumber).toBe(3);
    expect(existsSync(paths.journal)).toBe(true);
    expect(readFileSync(paths.journal, 'utf8')).toBe(
      '# Lessons Learned\n\n- **Path discovery**: read used a guessed filename. the discovered path was ignored. copy the exact discovered path into the next read.\n',
    );
  });

  it('creates a missing journal and reports line 1 for the first capture', () => {
    const paths = lessonsPaths(projectRoot);

    const result = appendLessonToJournal(projectRoot, {
      heading: 'First capture',
      whatWentWrong: 'nothing existed yet',
      rootCause: 'the journal had not been scaffolded',
      rule: 'create the journal before appending',
    });

    expect(result.lineNumber).toBe(1);
    expect(readFileSync(paths.journal, 'utf8')).toBe(`${result.bullet}\n`);
  });

  it('inserts exactly one newline when the existing journal has no trailing newline', () => {
    const paths = lessonsPaths(projectRoot);
    writeFileSync(paths.journal, '# Lessons Learned', 'utf8');

    const result = appendLessonToJournal(projectRoot, {
      heading: 'No trailing newline',
      whatWentWrong: 'the prior file ended mid-line',
      rootCause: 'manual edits removed the newline',
      rule: 'insert one separator newline before the next bullet',
    });

    expect(result.lineNumber).toBe(2);
    expect(readFileSync(paths.journal, 'utf8')).toBe(`# Lessons Learned\n${result.bullet}\n`);
  });

  it.each([
    [
      'empty heading',
      { heading: ' ', whatWentWrong: 'failed', rootCause: 'missing', rule: 'reject' },
      /heading/,
    ],
    [
      'empty sentence',
      { heading: 'Empty sentence', whatWentWrong: 'failed', rootCause: '', rule: 'reject' },
      /sentence/,
    ],
  ] as const)('rejects %s before writing', (_name, input, error) => {
    expect(() => formatLessonBullet(input)).toThrow(error);
  });
});
