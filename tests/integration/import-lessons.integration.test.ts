import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runImport } from '../../src/cli/commands/import.js';
import { LESSONS_PROCEDURAL_RULE, lessonsPaths } from '../../src/lessons/paths.js';

let projectRoot: string;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'import-lessons-'));
});

describe('import lessons safety net', () => {
  it('scaffolds lesson files when an imported root rule contains the lessons ritual', async () => {
    writeFileSync(
      join(projectRoot, 'CLAUDE.md'),
      `# Imported root\n\n${LESSONS_PROCEDURAL_RULE}\n`,
      'utf8',
    );

    const result = await runImport({ from: 'claude-code' }, projectRoot);

    expect(result.exitCode).toBe(0);
    expect(readFileSync(join(projectRoot, '.agentsmesh/rules/_root.md'), 'utf8')).toContain(
      '.agentsmesh/lessons/index.yaml',
    );
    expect(existsSync(lessonsPaths(projectRoot).index)).toBe(true);
    expect(existsSync(lessonsPaths(projectRoot).journal)).toBe(true);
  });
});
