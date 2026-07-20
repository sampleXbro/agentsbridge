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

describe('pack-originated key recognition across target-specific output paths', () => {
  // When a generated output is pack-originated, its broken links are advisory
  // warnings, not generate-blocking errors. Recognition relies on
  // `canonicalKeyFromOutputPath` mapping the output path to a canonical
  // `<feature>/<name>` key. The mapping must handle target-specific naming:
  //   - copilot strips `.agent.md`, `.instructions.md`, `.prompt.md`
  //   - factory-droid uses `droids/` for agents
  const cases: Array<{
    label: string;
    path: string;
    key: string;
    target: string;
  }> = [
    {
      label: 'claude-code agent',
      path: '.claude/agents/foo.md',
      key: 'agents/foo',
      target: 'claude-code',
    },
    {
      label: 'copilot agent (.agent.md)',
      path: '.github/agents/foo.agent.md',
      key: 'agents/foo',
      target: 'copilot',
    },
    {
      label: 'copilot rule (.instructions.md)',
      path: '.github/instructions/foo.instructions.md',
      key: 'rules/foo',
      target: 'copilot',
    },
    {
      label: 'copilot command (.prompt.md)',
      path: '.github/prompts/foo.prompt.md',
      key: 'commands/foo',
      target: 'copilot',
    },
    {
      label: 'factory-droid droid (.md)',
      path: '.factory/droids/foo.md',
      key: 'agents/foo',
      target: 'factory-droid',
    },
    { label: 'kiro steering', path: '.kiro/steering/foo.md', key: 'rules/foo', target: 'kiro' },
    {
      label: 'cline rules',
      path: '.cline/rules/foo.md',
      key: 'rules/foo',
      target: 'cline',
    },
    {
      label: 'skill SKILL.md',
      path: '.claude/skills/foo/SKILL.md',
      key: 'skills/foo',
      target: 'claude-code',
    },
  ];

  for (const c of cases) {
    it(`${c.label}: pack-originated broken link warns (key ${c.key})`, () => {
      const results: GenerateResult[] = [
        {
          target: c.target,
          path: c.path,
          content: 'See [docs](README.md).',
          status: 'created',
        },
      ];
      expect(() =>
        validateGeneratedMarkdownLinks(results, '/proj', { packOriginatedKeys: new Set([c.key]) }),
      ).not.toThrow();
    });
  }

  it('non-pack-originated broken link still throws (control)', () => {
    const results: GenerateResult[] = [
      {
        target: 'copilot',
        path: '.github/agents/foo.agent.md',
        content: 'See [docs](README.md).',
        status: 'created',
      },
    ];
    // packOriginatedKeys missing → must throw (matches the user's original failure).
    expect(() =>
      validateGeneratedMarkdownLinks(results, '/proj', { packOriginatedKeys: new Set() }),
    ).toThrow(/broken local links/);
  });

  it('mdc extension is recognized for pack-originated cursor rules', () => {
    // Covers stripMarkdownExt's `.mdc` branch when the file is in a known feature dir.
    const results: GenerateResult[] = [
      {
        target: 'cursor',
        path: '.cursor/rules/foo.mdc',
        content: 'See [docs](README.md).',
        status: 'created',
      },
    ];
    expect(() =>
      validateGeneratedMarkdownLinks(results, '/proj', {
        packOriginatedKeys: new Set(['rules/foo']),
      }),
    ).not.toThrow();
  });

  it('feature dir not in OUTPUT_DIR_TO_FEATURE falls through to top-level lookup', () => {
    // `.weirdtool/strangedir/foo.md` matches the 3-segment regex but the inner
    // dir `strangedir` is not in OUTPUT_DIR_TO_FEATURE, so the key resolver
    // returns null and the broken link reaches the error path.
    const results: GenerateResult[] = [
      {
        target: 'weirdtool',
        path: '.weirdtool/strangedir/foo.md',
        content: 'See [docs](README.md).',
        status: 'created',
      },
    ];
    expect(() =>
      validateGeneratedMarkdownLinks(results, '/proj', { packOriginatedKeys: new Set() }),
    ).toThrow(/broken local links/);
  });

  it('top-level non-rule dir does not classify as feature', () => {
    // `.notarulesdir/foo.md` matches m2 but `.notarulesdir` is not in
    // TOP_LEVEL_DIR_TO_FEATURE → canonical key is null → broken link errors.
    const results: GenerateResult[] = [
      {
        target: 'weirdtool',
        path: '.notarulesdir/foo.md',
        content: 'See [docs](README.md).',
        status: 'created',
      },
    ];
    expect(() =>
      validateGeneratedMarkdownLinks(results, '/proj', { packOriginatedKeys: new Set() }),
    ).toThrow(/broken local links/);
  });
});

describe('shouldSkipLocalValidation — link-target schemes that are not local files', () => {
  // Each scheme exercises a different branch in `shouldSkipLocalValidation`,
  // which previously had only the http(s) case covered.
  const schemes: Array<{ name: string; href: string }> = [
    { name: 'fragment-only', href: '#section' },
    { name: 'mailto', href: 'mailto:user@example.com' },
    { name: 'data URI', href: 'data:text/plain;base64,SGk=' },
    { name: 'javascript', href: 'javascript:void(0)' },
    { name: 'ftp', href: 'ftp://example.com/file' },
    { name: 'generic scheme', href: 'tel:+15555555' },
    { name: 'whitespace-only', href: '   ' },
    { name: 'absolute URL path outside project', href: '/en/docs/intro' },
  ];

  for (const s of schemes) {
    it(`ignores ${s.name} link`, () => {
      const results: GenerateResult[] = [
        {
          target: 'cursor',
          path: '.cursor/AGENTS.md',
          content: `See [a](${s.href}).`,
          status: 'created',
        },
      ];
      expect(() => validateGeneratedMarkdownLinks(results, '/proj')).not.toThrow();
    });
  }

  it('windows drive-letter absolute is treated as a local path (not skipped)', () => {
    // `C:\…` matches the drive-letter branch which explicitly returns FALSE
    // (continue validation). Since the file doesn't exist, the validator
    // throws — exercising the `return false` branch at line 45.
    const results: GenerateResult[] = [
      {
        target: 'cursor',
        path: '.cursor/AGENTS.md',
        content: 'See [a](C:/missing/file.md).',
        status: 'created',
      },
    ];
    expect(() => validateGeneratedMarkdownLinks(results, '/proj')).toThrow(/broken local links/);
  });

  it('absolute path inside project tree falls through to normal validation', () => {
    // `/proj/.agentsmesh/...` is project-rooted → R-1 keeps it in the strict
    // path, so the absent file triggers a real broken-link error.
    const results: GenerateResult[] = [
      {
        target: 'cursor',
        path: '.cursor/AGENTS.md',
        content: 'See [a](/proj/.agentsmesh/missing.md).',
        status: 'created',
      },
    ];
    expect(() => validateGeneratedMarkdownLinks(results, '/proj')).toThrow(/broken local links/);
  });
});

describe('REF_LINK_DEF tolerance — malformed reference targets are skipped', () => {
  it('empty reference URL is skipped (no false positive)', () => {
    // `[ref]: ` with empty url after the colon should not be reported as broken.
    const results: GenerateResult[] = [
      {
        target: 'cursor',
        path: '.cursor/AGENTS.md',
        content: '[ref]: <>\n\nhi',
        status: 'created',
      },
    ];
    expect(() => validateGeneratedMarkdownLinks(results, '/proj')).not.toThrow();
  });
});
