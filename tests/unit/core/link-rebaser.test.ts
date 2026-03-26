import { describe, expect, it } from 'vitest';
import { rewriteFileLinks } from '../../../src/core/link-rebaser.js';

describe('rewriteFileLinks', () => {
  it('rewrites ordinary project links and translated artifact links to project-root paths', () => {
    const rewritten = rewriteFileLinks({
      content: [
        'Docs: ../../docs/some-doc.md.',
        'Command: .agentsmesh/commands/review.md.',
        'Markdown: [../../docs/some-doc.md](../../docs/some-doc.md)',
      ].join('\n'),
      projectRoot: '/proj',
      sourceFile: '/proj/.agentsmesh/rules/_root.md',
      destinationFile: '/proj/CLAUDE.md',
      translatePath: (absolutePath) =>
        absolutePath === '/proj/.agentsmesh/commands/review.md'
          ? '/proj/.claude/commands/review.md'
          : absolutePath,
      pathExists: (absolutePath) =>
        absolutePath === '/proj/docs/some-doc.md' ||
        absolutePath === '/proj/.claude/commands/review.md',
    });

    expect(rewritten.content).toContain('Docs: docs/some-doc.md.');
    expect(rewritten.content).toContain('Command: .claude/commands/review.md.');
    expect(rewritten.content).toContain('[docs/some-doc.md](docs/some-doc.md)');
    expect(rewritten.missing).toEqual([]);
  });

  it('preserves missing links and reports them for validation', () => {
    const rewritten = rewriteFileLinks({
      content: 'Missing: ../../docs/missing.md.',
      projectRoot: '/proj',
      sourceFile: '/proj/.agentsmesh/rules/_root.md',
      destinationFile: '/proj/CLAUDE.md',
      translatePath: (absolutePath) => absolutePath,
      pathExists: () => false,
    });

    expect(rewritten.content).toBe('Missing: ../../docs/missing.md.');
    expect(rewritten.missing).toEqual(['/proj/docs/missing.md']);
  });

  it('rewrites over-traversal relative links by falling back to the project root when the in-repo target exists', () => {
    const rewritten = rewriteFileLinks({
      content: 'Check also ../../../../docs/agents-folder-structure-research.md.',
      projectRoot: '/proj',
      sourceFile: '/proj/.agentsmesh/skills/typescript-pro/SKILL.md',
      destinationFile: '/proj/.claude/skills/typescript-pro/SKILL.md',
      translatePath: (absolutePath) => absolutePath,
      pathExists: (absolutePath) =>
        absolutePath === '/proj/docs/agents-folder-structure-research.md',
    });

    expect(rewritten.content).toBe('Check also docs/agents-folder-structure-research.md.');
    expect(rewritten.missing).toEqual([]);
  });

  it('rewrites inline-code file references while keeping fenced code blocks untouched', () => {
    const rewritten = rewriteFileLinks({
      content: ['Inline: `../../docs/some-doc.md`.', '```', '../../docs/some-doc.md', '```'].join(
        '\n',
      ),
      projectRoot: '/proj',
      sourceFile: '/proj/.agentsmesh/rules/_root.md',
      destinationFile: '/proj/CLAUDE.md',
      translatePath: (absolutePath) => absolutePath,
      pathExists: (absolutePath) => absolutePath === '/proj/docs/some-doc.md',
    });

    expect(rewritten.content).toContain('Inline: `docs/some-doc.md`.');
    expect(rewritten.content).toContain('```\n../../docs/some-doc.md\n```');
    expect(rewritten.missing).toEqual([]);
  });

  it('rewrites target-native links back to canonical project-root paths on import', () => {
    const rewritten = rewriteFileLinks({
      content: 'Use .claude/commands/review.md and docs/some-doc.md.',
      projectRoot: '/proj',
      sourceFile: '/proj/CLAUDE.md',
      destinationFile: '/proj/.agentsmesh/rules/_root.md',
      translatePath: (absolutePath) =>
        absolutePath === '/proj/.claude/commands/review.md'
          ? '/proj/.agentsmesh/commands/review.md'
          : absolutePath,
      pathExists: (absolutePath) =>
        absolutePath === '/proj/.agentsmesh/commands/review.md' ||
        absolutePath === '/proj/docs/some-doc.md',
    });

    expect(rewritten.content).toContain('.agentsmesh/commands/review.md');
    expect(rewritten.content).toContain('docs/some-doc.md');
    expect(rewritten.missing).toEqual([]);
  });

  it('does not rewrite bare root artifact filenames in prose', () => {
    const rewritten = rewriteFileLinks({
      content: '# Windsurf via AGENTS.md and CLAUDE.md.',
      projectRoot: '/proj',
      sourceFile: '/proj/AGENTS.md',
      destinationFile: '/proj/.agentsmesh/rules/_root.md',
      translatePath: (absolutePath) => absolutePath,
      pathExists: (absolutePath) =>
        absolutePath === '/proj/AGENTS.md' || absolutePath === '/proj/CLAUDE.md',
    });

    expect(rewritten.content).toBe('# Windsurf via AGENTS.md and CLAUDE.md.');
    expect(rewritten.missing).toEqual([]);
  });

  it('does not rewrite glob patterns that contain path-like fragments', () => {
    const rewritten = rewriteFileLinks({
      content: 'globs: ["src/**/*.ts", "tests/**/*.ts"]',
      projectRoot: '/proj',
      sourceFile: '/proj/.github/copilot/ts.instructions.md',
      destinationFile: '/proj/.agentsmesh/rules/ts.md',
      translatePath: (absolutePath) => absolutePath,
      pathExists: () => false,
    });

    expect(rewritten.content).toBe('globs: ["src/**/*.ts", "tests/**/*.ts"]');
    expect(rewritten.missing).toEqual([]);
  });

  it('ignores status markers like ✓ / ✗ instead of treating the slash as a path', () => {
    const translated: string[] = [];
    const checked: string[] = [];
    const rewritten = rewriteFileLinks({
      content: 'Legend: ✓ / ✗',
      projectRoot: '/proj',
      sourceFile: '/proj/.agentsmesh/rules/_root.md',
      destinationFile: '/proj/CLAUDE.md',
      translatePath: (absolutePath) => {
        translated.push(absolutePath);
        return absolutePath;
      },
      pathExists: (absolutePath) => {
        checked.push(absolutePath);
        return false;
      },
    });

    expect(rewritten.content).toBe('Legend: ✓ / ✗');
    expect(rewritten.missing).toEqual([]);
    expect(translated).toEqual([]);
    expect(checked).toEqual([]);
  });

  it('rewrites absolute in-project paths to project-root-relative target paths', () => {
    const rewritten = rewriteFileLinks({
      content:
        'Absolute: /proj/.agentsmesh/rules/typescript.md, /proj/.agentsmesh/commands/review.md, /proj/.agentsmesh/skills/api-generator/references/route-checklist.md.',
      projectRoot: '/proj',
      sourceFile: '/proj/.agentsmesh/rules/_root.md',
      destinationFile: '/proj/CLAUDE.md',
      translatePath: (absolutePath) => {
        if (absolutePath === '/proj/.agentsmesh/rules/typescript.md') {
          return '/proj/.claude/rules/typescript.md';
        }
        if (absolutePath === '/proj/.agentsmesh/commands/review.md') {
          return '/proj/.claude/commands/review.md';
        }
        if (
          absolutePath === '/proj/.agentsmesh/skills/api-generator/references/route-checklist.md'
        ) {
          return '/proj/.claude/skills/api-generator/references/route-checklist.md';
        }
        return absolutePath;
      },
      pathExists: (absolutePath) =>
        absolutePath === '/proj/.claude/rules/typescript.md' ||
        absolutePath === '/proj/.claude/commands/review.md' ||
        absolutePath === '/proj/.claude/skills/api-generator/references/route-checklist.md',
    });

    expect(rewritten.content).toBe(
      'Absolute: .claude/rules/typescript.md, .claude/commands/review.md, .claude/skills/api-generator/references/route-checklist.md.',
    );
    expect(rewritten.missing).toEqual([]);
  });

  it('rewrites Windows drive-letter absolute paths when the project root is Windows-style', () => {
    const rewritten = rewriteFileLinks({
      content:
        'Windows absolute: C:\\proj\\.agentsmesh\\rules\\typescript.md, C:/proj/.agentsmesh/commands/review.md, C:\\proj\\.agentsmesh\\skills\\api-generator\\references\\route-checklist.md.',
      projectRoot: 'C:\\proj',
      sourceFile: 'C:\\proj\\.agentsmesh\\rules\\_root.md',
      destinationFile: 'C:\\proj\\CLAUDE.md',
      translatePath: (absolutePath) => {
        if (absolutePath === 'C:\\proj\\.agentsmesh\\rules\\typescript.md') {
          return 'C:\\proj\\.claude\\rules\\typescript.md';
        }
        if (absolutePath === 'C:\\proj\\.agentsmesh\\commands\\review.md') {
          return 'C:\\proj\\.claude\\commands\\review.md';
        }
        if (
          absolutePath ===
          'C:\\proj\\.agentsmesh\\skills\\api-generator\\references\\route-checklist.md'
        ) {
          return 'C:\\proj\\.claude\\skills\\api-generator\\references\\route-checklist.md';
        }
        return absolutePath;
      },
      pathExists: (absolutePath) =>
        absolutePath === 'C:\\proj\\.claude\\rules\\typescript.md' ||
        absolutePath === 'C:\\proj\\.claude\\commands\\review.md' ||
        absolutePath === 'C:\\proj\\.claude\\skills\\api-generator\\references\\route-checklist.md',
    });

    expect(rewritten.content).toBe(
      'Windows absolute: .claude/rules/typescript.md, .claude/commands/review.md, .claude/skills/api-generator/references/route-checklist.md.',
    );
    expect(rewritten.missing).toEqual([]);
  });

  it('rewrites backslash-relative and mixed-separator paths to forward-slash project-root paths', () => {
    const rewritten = rewriteFileLinks({
      content: [
        'Backslash relative: ..\\commands\\review.md, ..\\agents\\code-reviewer.md.',
        'Mixed: ..\\skills/api-generator\\SKILL.md, ..\\..\\docs/some-doc.md.',
        'Canonical mixed: .agentsmesh\\skills/api-generator\\references\\route-checklist.md.',
      ].join('\n'),
      projectRoot: '/proj',
      sourceFile: '/proj/.agentsmesh/rules/typescript.md',
      destinationFile: '/proj/CLAUDE.md',
      translatePath: (absolutePath) => {
        if (absolutePath === '/proj/.agentsmesh/commands/review.md') {
          return '/proj/.claude/commands/review.md';
        }
        if (absolutePath === '/proj/.agentsmesh/agents/code-reviewer.md') {
          return '/proj/.claude/agents/code-reviewer.md';
        }
        if (absolutePath === '/proj/.agentsmesh/skills/api-generator/SKILL.md') {
          return '/proj/.claude/skills/api-generator/SKILL.md';
        }
        if (
          absolutePath === '/proj/.agentsmesh/skills/api-generator/references/route-checklist.md'
        ) {
          return '/proj/.claude/skills/api-generator/references/route-checklist.md';
        }
        return absolutePath;
      },
      pathExists: (absolutePath) =>
        absolutePath === '/proj/.claude/commands/review.md' ||
        absolutePath === '/proj/.claude/agents/code-reviewer.md' ||
        absolutePath === '/proj/.claude/skills/api-generator/SKILL.md' ||
        absolutePath === '/proj/.claude/skills/api-generator/references/route-checklist.md' ||
        absolutePath === '/proj/docs/some-doc.md',
    });

    expect(rewritten.content).toContain(
      'Backslash relative: .claude/commands/review.md, .claude/agents/code-reviewer.md.',
    );
    expect(rewritten.content).toContain(
      'Mixed: .claude/skills/api-generator/SKILL.md, docs/some-doc.md.',
    );
    expect(rewritten.content).toContain(
      'Canonical mixed: .claude/skills/api-generator/references/route-checklist.md.',
    );
    expect(rewritten.missing).toEqual([]);
  });

  it('strips line-number suffixes and rewrites the base path', () => {
    const rewritten = rewriteFileLinks({
      content: [
        'See src/handler.ts:42 for the entry point.',
        'Also check ../../utils/parse.ts:10:5 for column info.',
        'Ref: ../../docs/guide.md:99.',
      ].join('\n'),
      projectRoot: '/proj',
      sourceFile: '/proj/.agentsmesh/rules/_root.md',
      destinationFile: '/proj/CLAUDE.md',
      translatePath: (absolutePath) => absolutePath,
      pathExists: (absolutePath) =>
        absolutePath === '/proj/src/handler.ts' ||
        absolutePath === '/proj/utils/parse.ts' ||
        absolutePath === '/proj/docs/guide.md',
    });

    expect(rewritten.content).toContain('See src/handler.ts:42 for the entry point.');
    expect(rewritten.content).toContain('Also check utils/parse.ts:10:5 for column info.');
    expect(rewritten.content).toContain('Ref: docs/guide.md:99.');
    expect(rewritten.missing).toEqual([]);
  });

  it('does not rewrite paths inside fenced code blocks', () => {
    const content = [
      'Before: ../../src/config.ts is important.',
      '```bash',
      'cd ../../src/config.ts',
      'cat ../../docs/guide.md',
      '```',
      'After: ../../src/config.ts should rewrite.',
    ].join('\n');

    const rewritten = rewriteFileLinks({
      content,
      projectRoot: '/proj',
      sourceFile: '/proj/.agentsmesh/rules/_root.md',
      destinationFile: '/proj/CLAUDE.md',
      translatePath: (absolutePath) => absolutePath,
      pathExists: (absolutePath) =>
        absolutePath === '/proj/src/config.ts' || absolutePath === '/proj/docs/guide.md',
    });

    expect(rewritten.content).toContain('Before: src/config.ts is important.');
    expect(rewritten.content).toContain('cd ../../src/config.ts');
    expect(rewritten.content).toContain('cat ../../docs/guide.md');
    expect(rewritten.content).toContain('After: src/config.ts should rewrite.');
    expect(rewritten.missing).toEqual([]);
  });

  it('rewrites paths inside inline code spans', () => {
    const rewritten = rewriteFileLinks({
      content: 'Run `../../src/config.ts` to check, but ../../src/config.ts is the real ref.',
      projectRoot: '/proj',
      sourceFile: '/proj/.agentsmesh/rules/_root.md',
      destinationFile: '/proj/CLAUDE.md',
      translatePath: (absolutePath) => absolutePath,
      pathExists: (absolutePath) => absolutePath === '/proj/src/config.ts',
    });

    expect(rewritten.content).toBe(
      'Run `src/config.ts` to check, but src/config.ts is the real ref.',
    );
    expect(rewritten.missing).toEqual([]);
  });

  it('ignores protocol-relative URLs instead of treating them as paths', () => {
    const translated: string[] = [];
    const checked: string[] = [];
    const content = ['CDN: //cdn.example.com/lib.js', 'API: //api.example.com/v1/data'].join('\n');

    const rewritten = rewriteFileLinks({
      content,
      projectRoot: '/proj',
      sourceFile: '/proj/.agentsmesh/rules/_root.md',
      destinationFile: '/proj/CLAUDE.md',
      translatePath: (absolutePath) => {
        translated.push(absolutePath);
        return absolutePath;
      },
      pathExists: (absolutePath) => {
        checked.push(absolutePath);
        return false;
      },
    });

    expect(rewritten.content).toBe(content);
    expect(rewritten.missing).toEqual([]);
    expect(translated).toEqual([]);
    expect(checked).toEqual([]);
  });

  it('ignores external URI-like and SCP-style refs that are not project file paths', () => {
    const translated: string[] = [];
    const checked: string[] = [];
    const content = [
      'Git SCP: git@github.com:owner/repo.git',
      'SSH URI: ssh://git@github.com/owner/repo.git',
      'Mail: mailto:test@example.com',
      'FTP: ftp://example.com/file',
      'VSCode: vscode://file/path',
      'Package: npm:@scope/pkg',
      'Docker: docker://ghcr.io/org/img',
    ].join('\n');

    const rewritten = rewriteFileLinks({
      content,
      projectRoot: '/proj',
      sourceFile: '/proj/.agentsmesh/rules/_root.md',
      destinationFile: '/proj/CLAUDE.md',
      translatePath: (absolutePath) => {
        translated.push(absolutePath);
        return absolutePath;
      },
      pathExists: (absolutePath) => {
        checked.push(absolutePath);
        return false;
      },
    });

    expect(rewritten.content).toBe(content);
    expect(rewritten.missing).toEqual([]);
    expect(translated).toEqual([]);
    expect(checked).toEqual([]);
  });
});
