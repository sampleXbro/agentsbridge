import { describe, expect, it } from 'vitest';
import {
  LESSONS_PARAGRAPH_BLOCK,
  appendLessonsParagraph,
  stripLessonsParagraph,
} from '../../../../src/targets/projection/lessons-paragraph.js';
import {
  LESSONS_CONTRACT_START,
  LESSONS_CONTRACT_END,
} from '../../../../src/targets/projection/managed-blocks.js';
import { LESSONS_PROCEDURAL_RULE } from '../../../../src/lessons/paths.js';

describe('LESSONS_PARAGRAPH_BLOCK', () => {
  it('wraps the procedural rule body in the lessons-contract sentinels', () => {
    expect(LESSONS_PARAGRAPH_BLOCK.startsWith(LESSONS_CONTRACT_START)).toBe(true);
    expect(LESSONS_PARAGRAPH_BLOCK.endsWith(LESSONS_CONTRACT_END)).toBe(true);
    expect(LESSONS_PARAGRAPH_BLOCK).toContain(LESSONS_PROCEDURAL_RULE);
  });
});

describe('appendLessonsParagraph', () => {
  it('appends the managed block to plain content', () => {
    const out = appendLessonsParagraph('# Root\n\nbody');
    expect(out).toContain('# Root');
    expect(out).toContain(LESSONS_CONTRACT_START);
    expect(out).toContain(LESSONS_CONTRACT_END);
    expect(out.endsWith(LESSONS_CONTRACT_END)).toBe(true);
  });

  it('replaces an existing managed block instead of duplicating it', () => {
    const once = appendLessonsParagraph('# Root\n\nbody');
    const twice = appendLessonsParagraph(once);
    expect(twice).toBe(once);
    expect(twice.match(new RegExp(LESSONS_CONTRACT_START, 'g'))?.length).toBe(1);
  });

  it('refreshes a stale managed block to the current wording', () => {
    const stale = `# Root\n\n${LESSONS_CONTRACT_START}\n## Lessons (OLD WORDING)\n\nout of date\n${LESSONS_CONTRACT_END}`;
    const out = appendLessonsParagraph(stale);
    expect(out).toContain(LESSONS_PROCEDURAL_RULE);
    expect(out).not.toContain('OLD WORDING');
    expect(out.match(new RegExp(LESSONS_CONTRACT_START, 'g'))?.length).toBe(1);
  });

  it('upgrades a legacy raw (sentinel-less) paragraph to the managed block', () => {
    const legacy = `# Root\n\nbody\n\n${LESSONS_PROCEDURAL_RULE}`;
    const out = appendLessonsParagraph(legacy);
    expect(out).toContain(LESSONS_CONTRACT_START);
    // The raw paragraph must not survive un-wrapped alongside the block.
    expect(out.match(/## Lessons \(/g)?.length).toBe(1);
  });
});

describe('stripLessonsParagraph', () => {
  it('removes the managed block entirely', () => {
    const withBlock = appendLessonsParagraph('# Root\n\nbody');
    const out = stripLessonsParagraph(withBlock);
    expect(out).toBe('# Root\n\nbody');
    expect(out).not.toContain(LESSONS_CONTRACT_START);
    expect(out).not.toContain('## Lessons (');
  });

  it('removes a legacy raw paragraph appended at the end', () => {
    const legacy = `# Root\n\nbody\n\n${LESSONS_PROCEDURAL_RULE}`;
    const out = stripLessonsParagraph(legacy);
    expect(out).toBe('# Root\n\nbody');
    expect(out).not.toContain('## Lessons (');
  });

  it('is a no-op when there is no lessons content', () => {
    expect(stripLessonsParagraph('# Root\n\nbody')).toBe('# Root\n\nbody');
  });

  it('strips a legacy raw paragraph that is the entire content (no leading newlines)', () => {
    expect(stripLessonsParagraph(LESSONS_PROCEDURAL_RULE)).toBe('');
  });

  it('upgrade collapses a legacy raw form sitting at the very start of the content', () => {
    const out = appendLessonsParagraph(`${LESSONS_PROCEDURAL_RULE}\n\n# After`);
    expect(out).toContain(LESSONS_CONTRACT_START);
    expect(out.match(/## Lessons \(/g)?.length).toBe(1);
    expect(out).toContain('# After');
  });

  it('round-trips: strip(append(x)) === trim(x)', () => {
    const base = '# Root\n\nbody';
    expect(stripLessonsParagraph(appendLessonsParagraph(base))).toBe(base);
  });
});
