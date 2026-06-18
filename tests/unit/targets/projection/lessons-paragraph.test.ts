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

const LEGACY_RAW_RULE = `## Lessons (BLOCKING REQUIREMENT — MUST run both, no exceptions; the user will check)

Graph \`.agentsmesh/lessons/lessons.json\` is canonical — never hand-edit. Manual: the \`lessons\` skill.

**Recall — MUST run before every file edit and every state-changing command** (build/test/install/migrate/git-write): \`agentsmesh lessons query --file <path> --cmd <command>\`, then apply every rule. Pure-read commands (cat/ls/grep/git-log) and the recall query itself are exempt.

**Capture — MUST run immediately after any failure** (a failing test/CI/lint/typecheck, a code review, a user correction, a regression, or a wrong assumption — yours or anyone's): \`agentsmesh lessons add "<rule>" --topic <id> --trigger-file <glob> --evidence <sha|lesson-id>\`.

No shell? Use the \`lessons_query\` / \`lessons_add\` MCP tools. Skip either and the system does not exist.`;

describe('LESSONS_PARAGRAPH_BLOCK', () => {
  it('wraps the procedural rule body in the lessons-contract sentinels', () => {
    expect(LESSONS_PARAGRAPH_BLOCK.startsWith(LESSONS_CONTRACT_START)).toBe(true);
    expect(LESSONS_PARAGRAPH_BLOCK.endsWith(LESSONS_CONTRACT_END)).toBe(true);
    expect(LESSONS_PARAGRAPH_BLOCK).toContain(LESSONS_PROCEDURAL_RULE);
  });
});

describe('appendLessonsParagraph', () => {
  it('places the managed block at the top of plain content', () => {
    const out = appendLessonsParagraph('# Root\n\nbody');
    expect(out).toBe(`${LESSONS_PARAGRAPH_BLOCK}\n\n# Root\n\nbody`);
    expect(out.startsWith(LESSONS_CONTRACT_START)).toBe(true);
    expect(out.endsWith('body')).toBe(true);
  });

  it('places the block after frontmatter, before the body', () => {
    const content = '---\nroot: true\ndescription: ""\n---\n\n# Operational Guidelines\n\nrules';
    const out = appendLessonsParagraph(content);
    expect(out).toBe(
      `---\nroot: true\ndescription: ""\n---\n\n${LESSONS_PARAGRAPH_BLOCK}\n\n# Operational Guidelines\n\nrules`,
    );
    expect(out.startsWith('---\nroot: true\ndescription: ""\n---')).toBe(true);
  });

  it('relocates an existing end-of-body block to the top', () => {
    const content = `---\nroot: true\n---\n\n# Guidelines\n\nrules\n\n${LESSONS_PARAGRAPH_BLOCK}`;
    const out = appendLessonsParagraph(content);
    expect(out).toBe(`---\nroot: true\n---\n\n${LESSONS_PARAGRAPH_BLOCK}\n\n# Guidelines\n\nrules`);
    expect(out.match(new RegExp(LESSONS_CONTRACT_START, 'g'))?.length).toBe(1);
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

  it('de-duplicates a sentinel-less raw copy of the current rule into one managed block', () => {
    const raw = `# Root\n\nbody\n\n${LESSONS_PROCEDURAL_RULE}`;
    const out = appendLessonsParagraph(raw);
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

  it('removes a sentinel-less raw copy of the current rule appended at the end', () => {
    const raw = `# Root\n\nbody\n\n${LESSONS_PROCEDURAL_RULE}`;
    const out = stripLessonsParagraph(raw);
    expect(out).toBe('# Root\n\nbody');
    expect(out).not.toContain('## Lessons (');
  });

  it('removes a sentinel-less raw copy of prior wording appended at the end', () => {
    const raw = `# Root\n\nbody\n\n${LEGACY_RAW_RULE}`;
    const out = stripLessonsParagraph(raw);
    expect(out).toBe('# Root\n\nbody');
    expect(out).not.toContain('## Lessons (');
  });

  it('is a no-op when there is no lessons content', () => {
    expect(stripLessonsParagraph('# Root\n\nbody')).toBe('# Root\n\nbody');
  });

  it('strips a sentinel-less raw rule that is the entire content (no leading newlines)', () => {
    expect(stripLessonsParagraph(LESSONS_PROCEDURAL_RULE)).toBe('');
  });

  it('collapses a sentinel-less raw rule sitting at the very start of the content', () => {
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
