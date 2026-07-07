import { describe, it, expect } from 'vitest';
import {
  LESSONS_SKILL_NAME,
  LESSONS_SKILL_DESCRIPTION,
  LESSONS_SKILL_BODY,
  LESSONS_SKILL_FILE,
} from '../../../src/lessons/skill.js';
import { parseFrontmatter } from '../../../src/utils/text/markdown.js';
import { LESSONS_SUBCOMMANDS } from '../../../src/cli/commands/lessons-usage.js';

describe('lessons skill content', () => {
  it('serializes a canonical SKILL.md with the lessons name + a non-empty description', () => {
    const { frontmatter, body } = parseFrontmatter(LESSONS_SKILL_FILE);
    expect(frontmatter.name).toBe('lessons');
    expect(LESSONS_SKILL_NAME).toBe('lessons');
    expect(typeof frontmatter.description).toBe('string');
    expect((frontmatter.description as string).length).toBeGreaterThan(0);
    expect(frontmatter.description).toBe(LESSONS_SKILL_DESCRIPTION);
    expect(body).toBe(LESSONS_SKILL_BODY);
  });

  it('points to --help for the full flag/subcommand reference (skill kept short)', () => {
    // Best practice: move command/flag detail to tool help instead of restating it
    // in the skill. The names stay (docs-sync below) but per-flag mechanics live in
    // `agentsmesh lessons --help`, and the essential capture trigger flag remains.
    expect(LESSONS_SKILL_BODY).toContain('agentsmesh lessons --help');
    expect(LESSONS_SKILL_BODY).toContain('--trigger-file');
  });

  it('body names every implemented subcommand (docs-sync gate)', () => {
    // Best practice keeps the DESCRIPTION short (triggers only), so the full
    // subcommand surface is documented in the body. Tied to LESSONS_SUBCOMMANDS so
    // a new subcommand fails here until the manual documents it.
    for (const sub of LESSONS_SUBCOMMANDS) {
      expect(LESSONS_SKILL_BODY).toMatch(new RegExp(`\\b${sub.replaceAll('-', '\\-')}\\b`));
    }
  });

  it('keeps a short, trigger-first description (skill best practice)', () => {
    // superpowers writing-skills / Anthropic: third-person, "Use when…", triggers
    // only, no workflow summary, short. A workflow summary makes agents follow the
    // description instead of reading the skill body.
    expect(LESSONS_SKILL_DESCRIPTION.startsWith('Use when')).toBe(true);
    expect(LESSONS_SKILL_DESCRIPTION.length).toBeLessThanOrEqual(200);
    // Carries both binding triggers, so it self-surfaces as the always-on fallback.
    expect(LESSONS_SKILL_DESCRIPTION).toMatch(/edit a file|state-changing/i);
    expect(LESSONS_SKILL_DESCRIPTION).toMatch(/failure|correction/i);
  });

  it('keeps a recall-excuse killer so the agent cannot rationalize skipping', () => {
    expect(LESSONS_SKILL_BODY).toMatch(/excuses/i);
    expect(LESSONS_SKILL_BODY).toMatch(/query first/i);
    expect(LESSONS_SKILL_BODY).toMatch(/read-only/i);
  });

  it('documents the no-shell MCP fallback including the curation tools', () => {
    for (const tool of [
      'lessons_query',
      'lessons_add',
      'lessons_topics',
      'lessons_show',
      'lessons_deprecate',
    ]) {
      expect(LESSONS_SKILL_BODY).toContain(tool);
    }
  });

  it('names operational + decision-guard capture targets and steers triggers to the recurrence surface', () => {
    // Field blind spots: operational/tooling failures and "reviewed then deliberately kept"
    // decisions were never captured; and triggers were pinned to the discovery site.
    expect(LESSONS_SKILL_BODY).toContain('--trigger-cmd');
    expect(LESSONS_SKILL_BODY).toMatch(/deliberately REJECTED/i);
    expect(LESSONS_SKILL_BODY).toMatch(/file-CLASS where it will RECUR/i);
  });

  it('teaches the recall/capture reachability contract', () => {
    // Recall must be anchored to --file/--cmd; keyword-only is the anti-pattern.
    expect(LESSONS_SKILL_BODY).toMatch(/keyword-only/i);
    // Capture requires at least one EFFECTIVE trigger — a dead-only capture is
    // rejected (UNRECALLABLE_LESSON), not merely warned.
    expect(LESSONS_SKILL_BODY).toMatch(/at least one .*trigger is required/i);
    expect(LESSONS_SKILL_BODY).toContain('UNRECALLABLE_LESSON');
  });

  it('documents the before-final lesson gate and capture/non-capture receipt', () => {
    expect(LESSONS_SKILL_BODY).toContain('## Lesson gate — before final response');
    expect(LESSONS_SKILL_BODY).toMatch(/self-critique/i);
    expect(LESSONS_SKILL_BODY).toMatch(/useful surprise/i);
    expect(LESSONS_SKILL_BODY).toMatch(/non-obvious fix/i);
    expect(LESSONS_SKILL_BODY).toContain('Lesson: captured <id>');
    expect(LESSONS_SKILL_BODY).toContain('Lesson: none');
    expect(LESSONS_SKILL_BODY).toMatch(/Do not capture one-off facts/i);
  });

  it('still names both core commands so the manual is self-contained', () => {
    expect(LESSONS_SKILL_BODY).toContain('agentsmesh lessons query');
    expect(LESSONS_SKILL_BODY).toContain('agentsmesh lessons add');
  });
});
