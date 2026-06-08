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

/**
 * The prior shipped wording of the lessons rule (before the read-only-excuse /
 * broadened-failure revision). Kept here verbatim so we can prove the strip
 * path still upgrades a project that was generated with it. Mirrors the
 * legacy-body pattern in `root-instruction-paragraph.test.ts`.
 */
const LESSONS_RULE_V1 = `## Lessons (BLOCKING REQUIREMENT — MUST run, no exceptions)

Two shell commands. Skipping either is a process violation; the user will check. The graph at \`.agentsmesh/lessons/lessons.json\` is canonical — NEVER edit by hand.

**Recall — MUST run BEFORE every file edit and every shell command:**

1. Run: \`agentsmesh lessons query --file <path-about-to-edit> --cmd <command-about-to-run>\` (add \`--keyword <text>\` for task matches).
2. Apply EVERY returned rule.
3. Then perform the edit / run the command.

Rejected excuses: *"the edit is small"* → query it. *"I already know this"* → query it. *"I'll do it later"* → no.

**Capture — MUST run IMMEDIATELY after any failure** (test, CI, lint, code review, user correction, regression — anyone's mistake):

1. Run: \`agentsmesh lessons add "<imperative rule>" --topic <id> --trigger-file <glob> --evidence <commit-sha|lesson-id>\` (add \`--trigger-cmd <regex>\` / \`--trigger-kw <text>\` as needed).
2. Use \`agentsmesh lessons topics\` to find the topic id; pass \`--new-topic --topic-summary "<one line>"\` for a brand-new area.
3. The CLI writes \`lessons.json\` atomically — capture is one command.

Rejected excuses: *"it wasn't really a failure"* → it was. *"I'll capture it later"* → no. *"no topic fits"* → \`agentsmesh lessons topics\` then \`--new-topic\`.

No shell? Use the \`lessons_query\` and \`lessons_add\` MCP tools — same two operations. Run \`agentsmesh lessons --help\` for the full command set (\`show\`, \`deprecate\`, \`journal\`, \`validate\`, \`import-md\`).

**These two commands ARE the system. Skip them and the system does not exist.**`;

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

  it('strips the previous lessons-rule wording (legacy raw upgrade after a wording change)', () => {
    const out = stripLessonsParagraph(`# Root\n\nbody\n\n${LESSONS_RULE_V1}`);
    expect(out).toBe('# Root\n\nbody');
    expect(out).not.toContain('## Lessons (');
  });

  it('upgrade replaces the previous wording with the current managed block', () => {
    const out = appendLessonsParagraph(`# Root\n\nbody\n\n${LESSONS_RULE_V1}`);
    expect(out).toContain(LESSONS_PROCEDURAL_RULE);
    expect(out.match(/## Lessons \(/g)?.length).toBe(1);
  });
});
