/**
 * Branch coverage for src/targets/cursor/importer-rules.ts:
 * - rootWritten + alwaysApply true: skip secondary alwaysApply file.
 * - rootWritten=false then AGENTS.md fallback used.
 * - rootWritten=false + AGENTS.md missing + .cursorrules used.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFromCursor } from '../../../../src/targets/cursor/importer.js';

let projectRoot = '';

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'am-cursor-rules-'));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('importCursorRules — branch coverage', () => {
  it('imports root rule from AGENTS.md fallback when no .mdc files', async () => {
    writeFileSync(join(projectRoot, 'AGENTS.md'), '# Agents root rule\n');
    await importFromCursor(projectRoot);
    expect(existsSync(join(projectRoot, '.agentsmesh', 'rules', '_root.md'))).toBe(true);
  });

  it('imports root rule from .cursorrules legacy file when no .mdc or AGENTS.md', async () => {
    writeFileSync(join(projectRoot, '.cursorrules'), '# Cursor legacy root rule\n');
    await importFromCursor(projectRoot);
    const rootPath = join(projectRoot, '.agentsmesh', 'rules', '_root.md');
    expect(existsSync(rootPath)).toBe(true);
    expect(readFileSync(rootPath, 'utf-8')).toContain('Cursor legacy root rule');
  });

  it('prefers AGENTS.md over .cursorrules when both present and no .mdc root', async () => {
    writeFileSync(join(projectRoot, 'AGENTS.md'), '# Agents-wins root\n');
    writeFileSync(join(projectRoot, '.cursorrules'), '# Legacy losing root\n');
    await importFromCursor(projectRoot);
    const rootContent = readFileSync(
      join(projectRoot, '.agentsmesh', 'rules', '_root.md'),
      'utf-8',
    );
    expect(rootContent).toContain('Agents-wins root');
    expect(rootContent).not.toContain('Legacy losing root');
  });

  it('does NOT write second alwaysApply mdc file after root already written', async () => {
    mkdirSync(join(projectRoot, '.cursor', 'rules'), { recursive: true });
    writeFileSync(
      join(projectRoot, '.cursor', 'rules', '01-root.mdc'),
      '---\nalwaysApply: true\n---\n# Primary root\n',
    );
    writeFileSync(
      join(projectRoot, '.cursor', 'rules', '02-second.mdc'),
      '---\nalwaysApply: true\n---\n# Should be skipped\n',
    );
    await importFromCursor(projectRoot);
    const rootContent = readFileSync(
      join(projectRoot, '.agentsmesh', 'rules', '_root.md'),
      'utf-8',
    );
    // Only the first alwaysApply rule should be the root.
    expect(rootContent).toContain('Primary root');
    expect(rootContent).not.toContain('Should be skipped');
  });
});
