import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDistill } from '../../src/cli/commands/distill.js';
import { hashBullet } from '../../src/lessons/bullet-hash.js';
import { saveLedger } from '../../src/lessons/ledger.js';
import { lessonsPaths } from '../../src/lessons/paths.js';

let projectRoot: string;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'distill-cli-'));
  const paths = lessonsPaths(projectRoot);
  mkdirSync(paths.base, { recursive: true });
  mkdirSync(paths.topicsDir, { recursive: true });
});

afterEach(() => {
  if (projectRoot !== undefined && existsSync(projectRoot)) {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

function seedIndex(): void {
  writeFileSync(
    lessonsPaths(projectRoot).index,
    `version: 1
clusters:
  - topic: shell
    file: .agentsmesh/lessons/topics/shell.md
    summary: Shell lessons.
    triggers:
      file_globs: []
      command_patterns: ['^rg ']
      keywords: [backtick]
`,
    'utf8',
  );
  writeFileSync(join(lessonsPaths(projectRoot).topicsDir, 'shell.md'), '# Shell\n', 'utf8');
}

function seedJournal(bullets: string[]): void {
  writeFileSync(
    lessonsPaths(projectRoot).journal,
    `# Lessons Learned\n\n${bullets.join('\n')}\n`,
    'utf8',
  );
}

describe('runDistill (CLI command)', () => {
  it('check mode exits 0 when journal is empty', async () => {
    seedIndex();
    seedJournal([]);
    const result = await runDistill(projectRoot, { check: true });
    expect(result.exitCode).toBe(0);
    expect(result.data.mode).toBe('check');
    if (result.data.mode === 'check') {
      expect(result.data.checked).toBe(0);
      expect(result.data.unrouted).toEqual([]);
    }
  });

  it('check mode exits 1 with unrouted bullets listed', async () => {
    seedIndex();
    const bullet = '- **A**: backtick in rg pattern broke build.';
    seedJournal([bullet]);
    const result = await runDistill(projectRoot, { check: true });
    expect(result.exitCode).toBe(1);
    expect(result.data.mode).toBe('check');
    if (result.data.mode === 'check') {
      expect(result.data.unrouted).toHaveLength(1);
      expect(result.data.unrouted[0]?.preview).toContain('backtick');
    }
  });

  it('propose mode writes a proposal file and reports the count', async () => {
    seedIndex();
    seedJournal(['- **A**: backtick in rg pattern broke build.']);
    const result = await runDistill(projectRoot, {});
    expect(result.exitCode).toBe(0);
    expect(result.data.mode).toBe('propose');
    if (result.data.mode === 'propose') {
      expect(result.data.proposalCount).toBe(1);
      expect(result.data.proposalFile).not.toBeNull();
      expect(existsSync(lessonsPaths(projectRoot).proposal)).toBe(true);
    }
  });

  it('propose mode reports zero when everything is already routed', async () => {
    seedIndex();
    const bullet = '- **A**: backtick in rg pattern broke build.';
    seedJournal([bullet]);
    saveLedger(lessonsPaths(projectRoot).ledger, {
      version: 1,
      assignments: { [hashBullet(bullet)]: 'shell' },
    });
    const result = await runDistill(projectRoot, {});
    expect(result.exitCode).toBe(0);
    if (result.data.mode === 'propose') {
      expect(result.data.proposalCount).toBe(0);
      expect(result.data.proposalFile).toBeNull();
    }
  });

  it('apply mode reads decisions from the proposal and updates the ledger', async () => {
    seedIndex();
    const bullet = '- **A**: backtick in rg pattern broke build.';
    seedJournal([bullet]);
    await runDistill(projectRoot, {}); // write proposal

    const result = await runDistill(projectRoot, { apply: true });
    expect(result.exitCode).toBe(0);
    if (result.data.mode === 'apply') {
      expect(result.data.routed).toBe(1);
      expect(result.data.skipped).toBe(0);
    }

    // Subsequent check should now pass.
    const check = await runDistill(projectRoot, { check: true });
    expect(check.exitCode).toBe(0);
  });

  it('apply mode errors when there is no proposal file', async () => {
    seedIndex();
    seedJournal([]);
    await expect(runDistill(projectRoot, { apply: true })).rejects.toThrow(/No proposal file/i);
  });

  it('rejects --apply combined with --check', async () => {
    seedIndex();
    seedJournal([]);
    await expect(runDistill(projectRoot, { apply: true, check: true })).rejects.toThrow(
      /cannot be combined/i,
    );
  });
});
