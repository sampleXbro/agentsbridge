import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkJournalCoverage } from '../../../src/lessons/check.js';
import { hashBullet } from '../../../src/lessons/bullet-hash.js';
import { saveLedger } from '../../../src/lessons/ledger.js';
import { lessonsPaths } from '../../../src/lessons/paths.js';

let projectRoot: string;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'lessons-check-'));
});

afterEach(() => {
  if (projectRoot !== undefined && existsSync(projectRoot)) {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

function seedJournal(root: string, bullets: string[]): void {
  const paths = lessonsPaths(root);
  mkdirSync(paths.base, { recursive: true });
  writeFileSync(paths.journal, `# Lessons Learned\n\n${bullets.join('\n')}\n`, 'utf8');
}

describe('checkJournalCoverage', () => {
  it('returns ok=true when journal is empty (no bullets to route)', () => {
    seedJournal(projectRoot, []);
    const result = checkJournalCoverage(lessonsPaths(projectRoot));
    expect(result.ok).toBe(true);
    expect(result.checked).toBe(0);
    expect(result.unrouted).toEqual([]);
  });

  it('returns ok=true when the journal does not exist (fresh scaffold)', () => {
    const paths = lessonsPaths(projectRoot);
    expect(existsSync(paths.journal)).toBe(false);
    const result = checkJournalCoverage(paths);
    expect(result.ok).toBe(true);
    expect(result.checked).toBe(0);
  });

  it('returns ok=true when every bullet is in the ledger (skip or routed)', () => {
    const bulletA = '- **A**: rule.';
    const bulletB = '- **B**: rule.';
    seedJournal(projectRoot, [bulletA, bulletB]);
    const paths = lessonsPaths(projectRoot);
    saveLedger(paths.ledger, {
      version: 1,
      assignments: {
        [hashBullet(bulletA)]: 'lessons-a',
        [hashBullet(bulletB)]: 'skip',
      },
    });

    const result = checkJournalCoverage(paths);
    expect(result.ok).toBe(true);
    expect(result.checked).toBe(2);
    expect(result.unrouted).toEqual([]);
  });

  it('flags every unrouted bullet with its hash, line, and preview', () => {
    const routed = '- **Routed**: already in ledger.';
    const orphan1 = '- **Orphan one**: never distilled.';
    const orphan2 = '- **Orphan two**: also never distilled.';
    seedJournal(projectRoot, [routed, orphan1, orphan2]);
    const paths = lessonsPaths(projectRoot);
    saveLedger(paths.ledger, {
      version: 1,
      assignments: { [hashBullet(routed)]: 'lessons-x' },
    });

    const result = checkJournalCoverage(paths);
    expect(result.ok).toBe(false);
    expect(result.checked).toBe(3);
    expect(result.unrouted).toHaveLength(2);
    expect(result.unrouted.map((b) => b.lineNumber).sort()).toEqual([4, 5]);
    expect(result.unrouted[0]?.hash).toBe(hashBullet(orphan1));
    expect(result.unrouted[0]?.preview).toContain('Orphan one');
  });

  it('treats a missing ledger as everything being unrouted', () => {
    seedJournal(projectRoot, ['- **A**: rule.']);
    const result = checkJournalCoverage(lessonsPaths(projectRoot));
    expect(result.ok).toBe(false);
    expect(result.checked).toBe(1);
    expect(result.unrouted).toHaveLength(1);
  });

  it('truncates very long bullet previews to 120 chars', () => {
    const long = `- **Long**: ${'x'.repeat(500)}`;
    seedJournal(projectRoot, [long]);
    const result = checkJournalCoverage(lessonsPaths(projectRoot));
    expect(result.unrouted[0]?.preview.length).toBeLessThanOrEqual(120);
    expect(result.unrouted[0]?.preview.endsWith('...')).toBe(true);
  });
});
