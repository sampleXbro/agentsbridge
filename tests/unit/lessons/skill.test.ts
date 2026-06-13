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

  it('enumerates every implemented subcommand (L3 docs-sync gate)', () => {
    // The two primaries appear as full commands; the rest are enumerated in the
    // compact "Other subcommands" line. Assert each NAME is present as a word so
    // the manual documents the whole surface without repeating the prefix 13×.
    for (const sub of [
      'query',
      'add',
      'topics',
      'show',
      'deprecate',
      'merge',
      'untrigger',
      'strip-markers',
      'prune',
      'journal',
      'validate',
      'stats',
      'import-md',
    ]) {
      expect(LESSONS_SKILL_BODY).toMatch(new RegExp(`\\b${sub.replace('-', '\\-')}\\b`));
    }
    expect(LESSONS_SKILL_BODY).toContain('agentsmesh lessons query');
    expect(LESSONS_SKILL_BODY).toContain('agentsmesh lessons add');
    // Topic + trigger-flag mechanics.
    expect(LESSONS_SKILL_BODY).toContain('--new-topic');
    expect(LESSONS_SKILL_BODY).toContain('--topic-summary');
    expect(LESSONS_SKILL_BODY).toContain('--trigger-cmd');
    expect(LESSONS_SKILL_BODY).toContain('--trigger-kw');
  });

  it('frontmatter description names every implemented subcommand (docs-sync gate)', () => {
    // The harness uses the description to decide when to surface the skill, so it
    // must enumerate the whole subcommand surface — exactly the canonical list,
    // no omissions. Tied to LESSONS_SUBCOMMANDS so a new subcommand fails here.
    for (const sub of LESSONS_SUBCOMMANDS) {
      expect(LESSONS_SKILL_DESCRIPTION).toMatch(new RegExp(`\\b${sub.replaceAll('-', '\\-')}\\b`));
    }
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

  it('teaches the recall/capture reachability contract', () => {
    // Recall must be anchored to --file/--cmd; keyword-only is the anti-pattern.
    expect(LESSONS_SKILL_BODY).toMatch(/keyword-only/i);
    // Capture requires at least one EFFECTIVE trigger — a dead-only capture is
    // rejected (UNRECALLABLE_LESSON), not merely warned.
    expect(LESSONS_SKILL_BODY).toMatch(/at least one .*trigger is required/i);
    expect(LESSONS_SKILL_BODY).toContain('UNRECALLABLE_LESSON');
  });

  it('documents the recall caps and that recallMaxTokens is approximate', () => {
    expect(LESSONS_SKILL_BODY).toContain('recallLimit');
    expect(LESSONS_SKILL_BODY).toContain('recallMaxTokens');
    expect(LESSONS_SKILL_BODY).toMatch(/approximate|rule\.length \/ 4/);
  });

  it('still names both core commands so the manual is self-contained', () => {
    expect(LESSONS_SKILL_BODY).toContain('agentsmesh lessons query');
    expect(LESSONS_SKILL_BODY).toContain('agentsmesh lessons add');
  });
});
