import { describe, it, expect } from 'vitest';
import {
  lessonsPaths,
  toRelPath,
  LESSONS_JOURNAL_TEMPLATE,
  LESSONS_INDEX_TEMPLATE,
  LESSONS_PROCEDURAL_RULE,
} from '../../../src/lessons/paths.js';

describe('lessonsPaths', () => {
  it('derives all paths under .agentsmesh/lessons/', () => {
    const p = lessonsPaths('/proj');
    expect(p.base).toBe('/proj/.agentsmesh/lessons');
    expect(p.journal).toBe('/proj/.agentsmesh/lessons/journal.md');
    expect(p.index).toBe('/proj/.agentsmesh/lessons/index.yaml');
    expect(p.ledger).toBe('/proj/.agentsmesh/lessons/distill-ledger.yaml');
    expect(p.proposal).toBe('/proj/.agentsmesh/lessons/distill-proposal.md');
    expect(p.topicsDir).toBe('/proj/.agentsmesh/lessons/topics');
  });
});

describe('toRelPath', () => {
  it('returns project-relative forward-slash path', () => {
    expect(toRelPath('/proj', '/proj/.agentsmesh/lessons/topics/foo.md')).toBe(
      '.agentsmesh/lessons/topics/foo.md',
    );
  });
});

describe('LESSONS_JOURNAL_TEMPLATE', () => {
  it('is a non-empty markdown header', () => {
    expect(LESSONS_JOURNAL_TEMPLATE).toMatch(/^# /);
  });
});

describe('LESSONS_INDEX_TEMPLATE', () => {
  it('is a valid empty index (zero clusters)', () => {
    expect(LESSONS_INDEX_TEMPLATE).toContain('version: 1');
    expect(LESSONS_INDEX_TEMPLATE).toContain('clusters: []');
  });
});

describe('LESSONS_PROCEDURAL_RULE', () => {
  it('declares both Recall and Capture obligations', () => {
    expect(LESSONS_PROCEDURAL_RULE).toContain('**Recall**');
    expect(LESSONS_PROCEDURAL_RULE).toContain('**Capture**');
    expect(LESSONS_PROCEDURAL_RULE).toContain('process violation');
  });

  it('names the canonical artifact paths so init scaffolding stays consistent', () => {
    expect(LESSONS_PROCEDURAL_RULE).toContain('.agentsmesh/lessons/index.yaml');
    expect(LESSONS_PROCEDURAL_RULE).toContain('.agentsmesh/lessons/journal.md');
    expect(LESSONS_PROCEDURAL_RULE).toContain('.agentsmesh/lessons/topics/');
  });
});
