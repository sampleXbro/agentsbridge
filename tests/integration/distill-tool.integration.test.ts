import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lessonsPaths } from '../../src/lessons/paths.js';

const REPO = fileURLToPath(new URL('../..', import.meta.url));
const paths = lessonsPaths(REPO);
const JOURNAL_BACKUP = `${paths.journal}.backup`;

function runDistill(): void {
  execSync('pnpm distill', { cwd: REPO, stdio: 'pipe' });
}

describe('distill tool', () => {
  beforeEach(() => {
    copyFileSync(paths.journal, JOURNAL_BACKUP);
    if (existsSync(paths.proposal)) rmSync(paths.proposal);
  });

  afterEach(() => {
    if (existsSync(JOURNAL_BACKUP)) {
      copyFileSync(JOURNAL_BACKUP, paths.journal);
      rmSync(JOURNAL_BACKUP);
    }
    if (existsSync(paths.proposal)) rmSync(paths.proposal);
  });

  it('produces no proposal when journal is in sync with ledger', () => {
    runDistill();
    const empty =
      existsSync(paths.proposal) === false ||
      readFileSync(paths.proposal, 'utf8').trim().length === 0;
    expect(empty).toBe(true);
  });

  it('produces exactly one proposal entry when one new bullet is appended', () => {
    writeFileSync(
      paths.journal,
      `${readFileSync(paths.journal, 'utf8')}\n- **A brand new lesson**: with rule.`,
      'utf8',
    );
    runDistill();
    expect(existsSync(paths.proposal)).toBe(true);
    const matches = readFileSync(paths.proposal, 'utf8').match(/^## L\d+/gm) ?? [];
    expect(matches.length).toBe(1);
  });
});
