import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runImport } from '../../src/cli/commands/import.js';
import { lessonsPaths } from '../../src/lessons/paths.js';
import { LESSONS_PARAGRAPH_BLOCK } from '../../src/targets/projection/lessons-paragraph.js';

let projectRoot: string;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'import-lessons-'));
});

describe('import lessons safety net', () => {
  it('reactivates the subsystem and preserves the ritual block when the imported root carries it', async () => {
    writeFileSync(
      join(projectRoot, 'CLAUDE.md'),
      `# Imported root\n\n${LESSONS_PARAGRAPH_BLOCK}\n`,
      'utf8',
    );

    const result = await runImport({ from: 'claude-code' }, projectRoot);
    expect(result.exitCode).toBe(0);

    // Subsystem activated…
    expect(existsSync(lessonsPaths(projectRoot).graph)).toBe(true);
    // …and the ritual block survives as canonical content.
    const root = readFileSync(join(projectRoot, '.agentsmesh/rules/_root.md'), 'utf8');
    expect(root).toContain('<!-- agentsmesh:lessons-contract:start -->');
    expect(root).toContain('agentsmesh lessons query');

    // No legacy artifacts are ever created.
    expect(existsSync(lessonsPaths(projectRoot).index)).toBe(false);
    expect(existsSync(lessonsPaths(projectRoot).journal)).toBe(false);
    expect(existsSync(lessonsPaths(projectRoot).topicsDir)).toBe(false);
  });

  it('does not activate lessons when the imported root has no lessons block', async () => {
    writeFileSync(join(projectRoot, 'CLAUDE.md'), '# Imported root\n\njust rules\n', 'utf8');

    const result = await runImport({ from: 'claude-code' }, projectRoot);
    expect(result.exitCode).toBe(0);
    expect(existsSync(lessonsPaths(projectRoot).graph)).toBe(false);
  });
});
