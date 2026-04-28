import { describe, expect, it } from 'vitest';
import type { GenerateResult } from '../../../src/core/types.js';
import {
  findBrokenMarkdownLinks,
  validateGeneratedMarkdownLinks,
} from '../../../src/core/reference/validate-generated-markdown-links.js';

/*
 * Companion to `link-rebaser-skill-absolute-links.test.ts`.
 *
 * The link rebaser leaves any token whose resolution does not exist (on disk or in
 * the planned-output set) untouched — by design, so that legitimate absolute paths
 * outside the project also pass through. The post-generate validator
 * (`validateGeneratedMarkdownLinks`) is what enforces "every clickable markdown
 * destination must resolve". These tests pin that down for absolute-link cases in
 * skill outputs.
 *
 * NB: the validator only inspects markdown link destinations (`[text](url)`) and
 * reference-style link definitions (`[ref]: url`). Inline-code/backtick prose is
 * intentionally NOT validated.
 */

describe('validateGeneratedMarkdownLinks: skill outputs with absolute links', () => {
  it('passes when an absolute markdown link destination resolves to a planned output file', () => {
    const results: GenerateResult[] = [
      {
        target: 'claude-code',
        path: '.claude/skills/qa/SKILL.md',
        content: 'See [TS rule](../../rules/typescript.md).',
        status: 'created',
      },
      {
        target: 'claude-code',
        path: '.claude/rules/typescript.md',
        content: 'TS rule',
        status: 'created',
      },
    ];
    expect(() => validateGeneratedMarkdownLinks(results, '/proj')).not.toThrow();
  });

  it('flags an unresolved absolute markdown link destination in a skill output', () => {
    const results: GenerateResult[] = [
      {
        target: 'claude-code',
        path: '.claude/skills/qa/SKILL.md',
        // Simulates a generated output that ended up with a stale absolute link
        // (e.g. canonical content embedded a non-existent absolute path that the
        // rewriter left untouched because it did not resolve).
        content: 'See [missing](/proj/.agentsmesh/rules/missing.md).',
        status: 'created',
      },
    ];

    const broken = findBrokenMarkdownLinks(results, '/proj');
    expect(broken).toHaveLength(1);
    expect(broken[0]?.generatePath).toBe('.claude/skills/qa/SKILL.md');
    expect(broken[0]?.target).toBe('claude-code');
    expect(broken[0]?.rawLink).toBe('/proj/.agentsmesh/rules/missing.md');
    expect(() => validateGeneratedMarkdownLinks(results, '/proj')).toThrow(/broken local links/);
  });

  it('flags an unresolved absolute markdown link destination in a skill supporting file', () => {
    const results: GenerateResult[] = [
      {
        target: 'claude-code',
        path: '.claude/skills/qa/references/checklist.md',
        content: '# Checklist\n\nSee [TS rule](/proj/.agentsmesh/rules/missing.md).',
        status: 'created',
      },
    ];

    expect(() => validateGeneratedMarkdownLinks(results, '/proj')).toThrow(/broken local links/);
  });

  it('flags an unresolved reference-style definition with an absolute URL in a skill output', () => {
    const results: GenerateResult[] = [
      {
        target: 'claude-code',
        path: '.claude/skills/qa/SKILL.md',
        content: 'See [missing][ref].\n\n[ref]: /proj/.agentsmesh/rules/missing.md',
        status: 'created',
      },
    ];

    const broken = findBrokenMarkdownLinks(results, '/proj');
    expect(broken).toHaveLength(1);
    expect(broken[0]?.rawLink).toBe('/proj/.agentsmesh/rules/missing.md');
    expect(() => validateGeneratedMarkdownLinks(results, '/proj')).toThrow();
  });

  it('does NOT flag a backtick-prose absolute path that is unresolved (validator only checks markdown destinations)', () => {
    const results: GenerateResult[] = [
      {
        target: 'claude-code',
        path: '.claude/skills/qa/SKILL.md',
        content: 'Mention `/proj/.agentsmesh/rules/missing.md` in prose only.',
        status: 'created',
      },
    ];
    expect(() => validateGeneratedMarkdownLinks(results, '/proj')).not.toThrow();
    expect(findBrokenMarkdownLinks(results, '/proj')).toEqual([]);
  });

  it('passes when an absolute markdown destination resolves to a planned skill directory', () => {
    const results: GenerateResult[] = [
      {
        target: 'claude-code',
        path: '.claude/skills/qa/SKILL.md',
        // After rewriting, the absolute link to a sibling skill folder becomes
        // a destination-relative directory link. The destination directory is
        // implied by the `release-manager/SKILL.md` planned output's parent.
        content: 'Open [release manager](../release-manager/).',
        status: 'created',
      },
      {
        target: 'claude-code',
        path: '.claude/skills/release-manager/SKILL.md',
        content: 'release manager',
        status: 'created',
      },
    ];
    expect(() => validateGeneratedMarkdownLinks(results, '/proj')).not.toThrow();
  });
});
