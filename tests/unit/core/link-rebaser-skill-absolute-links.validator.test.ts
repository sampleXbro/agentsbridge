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

  it('surfaces an unresolved absolute markdown link in a skill output as a warning, not an error', () => {
    // R-4: skill outputs are third-party content materialized from install
    // packs. Broken links inside them are reported as warnings instead of
    // blocking `generate`. They remain visible via `findBrokenMarkdownLinks`
    // so callers can render them, just no longer throw.
    const results: GenerateResult[] = [
      {
        target: 'claude-code',
        path: '.claude/skills/qa/SKILL.md',
        content: 'See [missing](/proj/.agentsmesh/rules/missing.md).',
        status: 'created',
      },
    ];

    const broken = findBrokenMarkdownLinks(results, '/proj');
    expect(broken).toHaveLength(1);
    expect(broken[0]?.generatePath).toBe('.claude/skills/qa/SKILL.md');
    expect(broken[0]?.target).toBe('claude-code');
    expect(broken[0]?.rawLink).toBe('/proj/.agentsmesh/rules/missing.md');
    expect(() => validateGeneratedMarkdownLinks(results, '/proj')).not.toThrow();
  });

  it('surfaces an unresolved absolute markdown link in a skill supporting file as a warning', () => {
    const results: GenerateResult[] = [
      {
        target: 'claude-code',
        path: '.claude/skills/qa/references/checklist.md',
        content: '# Checklist\n\nSee [TS rule](/proj/.agentsmesh/rules/missing.md).',
        status: 'created',
      },
    ];
    expect(() => validateGeneratedMarkdownLinks(results, '/proj')).not.toThrow();
    expect(findBrokenMarkdownLinks(results, '/proj').length).toBe(1);
  });

  it('surfaces an unresolved reference-style absolute URL in a skill output as a warning', () => {
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
    expect(() => validateGeneratedMarkdownLinks(results, '/proj')).not.toThrow();
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

  it('does NOT flag a URL-style absolute path that is not under projectRoot (treats it as external)', () => {
    // Skills published by Anthropic frequently embed links like
    // `/en/docs/agents-and-tools/agent-skills/overview` that are URL paths,
    // not filesystem references. They must not block `generate`.
    const results: GenerateResult[] = [
      {
        target: 'claude-code',
        path: '.claude/skills/writing-skills/anthropic-best-practices.md',
        content: 'See [overview](/en/docs/agents-and-tools/agent-skills/overview).',
        status: 'created',
      },
    ];
    expect(() => validateGeneratedMarkdownLinks(results, '/proj')).not.toThrow();
    expect(findBrokenMarkdownLinks(results, '/proj')).toEqual([]);
  });

  it('does NOT throw on broken links inside skill outputs (treats them as warnings)', () => {
    // R-4: third-party skill content frequently references sibling-dir resources
    // that aren't materialized in the user's project. We must not block generate
    // on these; they're informational warnings instead.
    const results: GenerateResult[] = [
      {
        target: 'claude-code',
        path: '.claude/skills/video/SKILL.md',
        content: 'See [tool](../../tools/integrations/heygen.md).',
        status: 'created',
      },
    ];
    expect(() => validateGeneratedMarkdownLinks(results, '/proj')).not.toThrow();
    // Still surfaced by findBrokenMarkdownLinks so callers can render warnings.
    expect(findBrokenMarkdownLinks(results, '/proj').length).toBe(1);
  });

  it('STILL throws on broken links in non-skill outputs (rules, agents, commands)', () => {
    // R-4 only relaxes skill outputs; user-authored rules/agents/commands stay strict.
    const results: GenerateResult[] = [
      {
        target: 'claude-code',
        path: '.claude/rules/typescript.md',
        content: 'See [missing](./nowhere.md).',
        status: 'created',
      },
    ];
    expect(() => validateGeneratedMarkdownLinks(results, '/proj')).toThrow(/broken local links/);
  });

  it('R-4 ext: demotes broken links in pack-originated rules to warnings', () => {
    // User installed a pack whose rules reference siblings the user does not
    // have. The validator must NOT throw — the user can't fix upstream content.
    const results: GenerateResult[] = [
      {
        target: 'claude-code',
        path: '.claude/rules/code-review.md',
        content: 'See [security](security.md).',
        status: 'created',
      },
    ];
    const packKeys = new Set(['rules/code-review']);
    expect(() =>
      validateGeneratedMarkdownLinks(results, '/proj', { packOriginatedKeys: packKeys }),
    ).not.toThrow();
    expect(findBrokenMarkdownLinks(results, '/proj').length).toBe(1);
  });

  it('R-4 ext: demotes pack-originated rules emitted as .mdc (cursor), steering/ (kiro), and .cline/rules/', () => {
    const results: GenerateResult[] = [
      {
        target: 'cursor',
        path: '.cursor/rules/code-review.mdc',
        content: 'See [security](security.md).',
        status: 'created',
      },
      {
        target: 'kiro',
        path: '.kiro/steering/code-review.md',
        content: 'See [security](security.md).',
        status: 'created',
      },
      {
        target: 'cline',
        path: '.cline/rules/code-review.md',
        content: 'See [security](security.md).',
        status: 'created',
      },
    ];
    const packKeys = new Set(['rules/code-review']);
    expect(() =>
      validateGeneratedMarkdownLinks(results, '/proj', { packOriginatedKeys: packKeys }),
    ).not.toThrow();
  });

  it('R-4 ext: still throws when the broken link is in a USER-authored rule alongside pack rules', () => {
    const results: GenerateResult[] = [
      {
        target: 'claude-code',
        path: '.claude/rules/typescript.md',
        content: 'See [missing](./nowhere.md).',
        status: 'created',
      },
      {
        target: 'claude-code',
        path: '.claude/rules/code-review.md',
        content: 'See [security](security.md).',
        status: 'created',
      },
    ];
    const packKeys = new Set(['rules/code-review']);
    expect(() =>
      validateGeneratedMarkdownLinks(results, '/proj', { packOriginatedKeys: packKeys }),
    ).toThrow(/typescript\.md/);
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
