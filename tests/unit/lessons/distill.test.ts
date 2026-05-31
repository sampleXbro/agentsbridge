import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyDistill, proposeDistill } from '../../../src/lessons/distill.js';
import { hashBullet } from '../../../src/lessons/bullet-hash.js';
import { loadLedger, saveLedger } from '../../../src/lessons/ledger.js';
import { lessonsPaths } from '../../../src/lessons/paths.js';

let projectRoot: string;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'distill-lib-'));
  const paths = lessonsPaths(projectRoot);
  mkdirSync(paths.base, { recursive: true });
  writeFileSync(
    paths.index,
    `version: 1
clusters:
  - topic: shell
    file: .agentsmesh/lessons/topics/shell.md
    summary: Shell stuff.
    triggers:
      file_globs: []
      command_patterns: ['^rg ']
      keywords: [backtick]
`,
    'utf8',
  );
});

afterEach(() => {
  if (projectRoot !== undefined && existsSync(projectRoot)) {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

function seedJournal(bullets: string[]): void {
  writeFileSync(
    lessonsPaths(projectRoot).journal,
    `# Lessons Learned\n\n${bullets.join('\n')}\n`,
    'utf8',
  );
}

describe('proposeDistill', () => {
  it('returns zero proposals and clears any existing proposal file when nothing is unrouted', () => {
    const bullet = '- **A**: rule.';
    seedJournal([bullet]);
    const paths = lessonsPaths(projectRoot);
    saveLedger(paths.ledger, {
      version: 1,
      assignments: { [hashBullet(bullet)]: 'shell' },
    });
    writeFileSync(paths.proposal, 'stale content', 'utf8');

    const result = proposeDistill(paths);
    expect(result.proposals).toEqual([]);
    expect(result.proposalFileWritten).toBeNull();
    expect(readFileSync(paths.proposal, 'utf8')).toBe('');
  });

  it('writes a proposal file with rendered NO MATCH and ranked entries', () => {
    seedJournal([
      '- **Matched**: backtick in rg pattern broke build.',
      '- **NoMatch**: completely unrelated lesson about typography.',
    ]);
    const result = proposeDistill(lessonsPaths(projectRoot));
    expect(result.proposals).toHaveLength(2);
    expect(result.proposalFileWritten).not.toBeNull();
    const body = readFileSync(lessonsPaths(projectRoot).proposal, 'utf8');
    expect(body).toContain('NO MATCH');
    expect(body).toContain('proposed: shell');
    expect(body).toContain('decision: shell');
    expect(body).toContain('decision: skip');
  });
});

describe('applyDistill', () => {
  it('throws when the proposal file does not exist', () => {
    seedJournal([]);
    expect(() => applyDistill(lessonsPaths(projectRoot))).toThrow(/No proposal file/i);
  });

  it('records skip and routed decisions independently and clears the proposal', () => {
    seedJournal(['- **A**: routed bullet about backtick.', '- **B**: skipped meta-bullet.']);
    const paths = lessonsPaths(projectRoot);
    proposeDistill(paths);
    // Force the second bullet's decision to skip.
    const proposal = readFileSync(paths.proposal, 'utf8');
    writeFileSync(
      paths.proposal,
      proposal.replace(/decision: skip\n$/m, 'decision: skip\n'),
      'utf8',
    );

    const result = applyDistill(paths);
    expect(result.routed + result.skipped).toBe(2);
    expect(result.unknownTopics).toEqual([]);
    expect(readFileSync(paths.proposal, 'utf8')).toBe('');
    const ledger = loadLedger(paths.ledger);
    expect(Object.keys(ledger.assignments)).toHaveLength(2);
  });

  it('throws when a decision references an unknown topic', () => {
    seedJournal(['- **A**: routed bullet about backtick.']);
    const paths = lessonsPaths(projectRoot);
    proposeDistill(paths);
    const proposal = readFileSync(paths.proposal, 'utf8');
    writeFileSync(
      paths.proposal,
      proposal.replace(/decision: shell/, 'decision: nonexistent-topic'),
      'utf8',
    );

    expect(() => applyDistill(paths)).toThrow(/Unknown topic\(s\) in decisions: nonexistent-topic/);
    // Ledger must NOT be updated when validation fails.
    const ledger = loadLedger(paths.ledger);
    expect(ledger.assignments).toEqual({});
  });

  it('ignores malformed proposal blocks without a hash or decision', () => {
    seedJournal([]);
    const paths = lessonsPaths(projectRoot);
    writeFileSync(
      paths.proposal,
      '# Distill proposal\n\n## (no hash here)\n\ndecision: shell\n\n## L1 (hash deadbeefdeadbeef)\n\n(no decision line)\n',
      'utf8',
    );

    const result = applyDistill(paths);
    expect(result.routed).toBe(0);
    expect(result.skipped).toBe(0);
  });
});
