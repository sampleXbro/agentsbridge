import { describe, it, expect } from 'vitest';
import {
  LESSONS_SKILL_NAME,
  LESSONS_SKILL_DESCRIPTION,
  LESSONS_SKILL_BODY,
  LESSONS_SKILL_FILE,
} from '../../../src/lessons/skill.js';
import { parseFrontmatter } from '../../../src/utils/text/markdown.js';

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

  it('carries the expansive how-to that the trimmed Tier-1 trigger drops', () => {
    // Full command set moved out of the always-on block and into the manual.
    for (const sub of ['show', 'deprecate', 'journal', 'validate', 'import-md', 'topics']) {
      expect(LESSONS_SKILL_BODY).toContain(`agentsmesh lessons ${sub}`);
    }
    // Topic + trigger-flag mechanics.
    expect(LESSONS_SKILL_BODY).toContain('--new-topic');
    expect(LESSONS_SKILL_BODY).toContain('--topic-summary');
    expect(LESSONS_SKILL_BODY).toContain('--trigger-cmd');
    expect(LESSONS_SKILL_BODY).toContain('--trigger-kw');
  });

  it('keeps the exhaustive rejected-excuse enumeration for both rituals', () => {
    expect(LESSONS_SKILL_BODY).toMatch(/Rejected excuses/);
    expect(LESSONS_SKILL_BODY).toMatch(/the edit is small/i);
    expect(LESSONS_SKILL_BODY).toMatch(/I'll capture it later/i);
    expect(LESSONS_SKILL_BODY).toMatch(/it wasn't really a failure/i);
  });

  it('documents the no-shell MCP fallback', () => {
    expect(LESSONS_SKILL_BODY).toContain('lessons_query');
    expect(LESSONS_SKILL_BODY).toContain('lessons_add');
  });

  it('still names both core commands so the manual is self-contained', () => {
    expect(LESSONS_SKILL_BODY).toContain('agentsmesh lessons query');
    expect(LESSONS_SKILL_BODY).toContain('agentsmesh lessons add');
  });
});
