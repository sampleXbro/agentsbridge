import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import type { GenerateResult } from '../../../src/core/types.js';
import {
  findBrokenMarkdownLinks,
  parseMarkdownLinkDestination,
  validateGeneratedMarkdownLinks,
} from '../../../src/core/reference/validate-generated-markdown-links.js';

describe('parseMarkdownLinkDestination', () => {
  it('strips title and angle brackets', () => {
    expect(parseMarkdownLinkDestination('./a.md "t"')).toBe('./a.md');
    expect(parseMarkdownLinkDestination('<./a.md>')).toBe('./a.md');
  });
});

describe('validateGeneratedMarkdownLinks', () => {
  const tmpBase = join(process.cwd(), 'tests/unit/core/tmp-validate-md-links');

  it('passes when link resolves to a planned output file', () => {
    const results: GenerateResult[] = [
      {
        target: 'cursor',
        path: '.cursor/AGENTS.md',
        content: 'See [skill](skills/x/SKILL.md).',
        status: 'created',
      },
      {
        target: 'cursor',
        path: '.cursor/skills/x/SKILL.md',
        content: 'ok',
        status: 'created',
      },
    ];
    expect(() => validateGeneratedMarkdownLinks(results, '/proj')).not.toThrow();
  });

  it('throws when inline link has no target', () => {
    const results: GenerateResult[] = [
      {
        target: 'cursor',
        path: '.cursor/AGENTS.md',
        content: 'See [missing](./nowhere.md).',
        status: 'created',
      },
    ];
    expect(() => validateGeneratedMarkdownLinks(results, '/proj')).toThrow(/broken local links/);
  });

  it('ignores remote URLs', () => {
    const results: GenerateResult[] = [
      {
        target: 'cursor',
        path: '.cursor/AGENTS.md',
        content: 'See [a](https://example.com/foo).',
        status: 'created',
      },
    ];
    expect(() => validateGeneratedMarkdownLinks(results, '/proj')).not.toThrow();
  });

  it('ignores links inside fenced code blocks', () => {
    const results: GenerateResult[] = [
      {
        target: 'cursor',
        path: '.cursor/AGENTS.md',
        content: '```\n[b](./gone.md)\n```',
        status: 'created',
      },
    ];
    expect(() => validateGeneratedMarkdownLinks(results, '/proj')).not.toThrow();
  });

  it('findBrokenMarkdownLinks reports details', () => {
    const results: GenerateResult[] = [
      {
        target: 'cursor',
        path: '.cursor/a.md',
        content: 'x [z](./q.md)',
        status: 'created',
      },
    ];
    const broken = findBrokenMarkdownLinks(results, '/proj');
    expect(broken).toHaveLength(1);
    expect(broken[0]?.rawLink).toContain('./q.md');
  });

  it('accepts link to an on-disk file under projectRoot', () => {
    mkdirSync(join(tmpBase, 'docs'), { recursive: true });
    writeFileSync(join(tmpBase, 'docs/existing.md'), 'hi');
    try {
      const results: GenerateResult[] = [
        {
          target: 'cursor',
          path: 'docs/readme.md',
          content: '[e](./existing.md)',
          status: 'created',
        },
      ];
      expect(() => validateGeneratedMarkdownLinks(results, tmpBase)).not.toThrow();
    } finally {
      rmSync(tmpBase, { recursive: true, force: true });
    }
  });

  it('accepts reference-style link targets', () => {
    const results: GenerateResult[] = [
      {
        target: 'cursor',
        path: '.cursor/AGENTS.md',
        content: '[ref]: skills/y/SKILL.md\n\nhi [ref][ref]',
        status: 'created',
      },
      {
        target: 'cursor',
        path: '.cursor/skills/y/SKILL.md',
        content: 'body',
        status: 'created',
      },
    ];
    expect(() => validateGeneratedMarkdownLinks(results, '/proj')).not.toThrow();
  });
});
