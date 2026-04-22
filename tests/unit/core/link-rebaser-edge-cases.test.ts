import { describe, expect, it } from 'vitest';
import { rewriteFileLinks } from '../../../src/core/reference/link-rebaser.js';

type RewriteInput = Parameters<typeof rewriteFileLinks>[0];

function noopInput(content: string): {
  input: RewriteInput;
  translated: string[];
  checked: string[];
} {
  const translated: string[] = [];
  const checked: string[] = [];
  return {
    input: {
      content,
      projectRoot: '/proj',
      sourceFile: '/proj/.agentsmesh/rules/_root.md',
      destinationFile: '/proj/CLAUDE.md',
      translatePath: (abs: string) => {
        translated.push(abs);
        return abs;
      },
      pathExists: (abs: string) => {
        checked.push(abs);
        return false;
      },
    },
    translated,
    checked,
  };
}

function rewriteInput(content: string, existingPaths: string[]): RewriteInput {
  const pathSet = new Set(existingPaths);
  return {
    content,
    projectRoot: '/proj',
    sourceFile: '/proj/.agentsmesh/rules/_root.md',
    destinationFile: '/proj/CLAUDE.md',
    translatePath: (abs: string) => abs,
    pathExists: (abs: string) => pathSet.has(abs),
  };
}

describe('rewriteFileLinks edge cases', () => {
  describe('home-relative paths (~/)', () => {
    it('does not partially rewrite ~/.agentsmesh (avoids ~/../.agentsmesh)', () => {
      const content =
        'Global install uses ~/.agentsmesh/rules/example.md or ~/.agentsmesh/skills/foo/.';
      const input = rewriteInput(content, ['/proj/.agentsmesh/rules/example.md']);
      const result = rewriteFileLinks(input);
      expect(result.content).toBe(content);
    });

    it('does not partially rewrite ~/.cursor paths', () => {
      const content = 'See ~/.cursor/rules/bar.md';
      const input = rewriteInput(content, ['/proj/.cursor/rules/bar.md']);
      expect(rewriteFileLinks(input).content).toBe(content);
    });
  });

  describe('external reference protection', () => {
    it('protects data URIs', () => {
      const { input, translated } = noopInput('![img](data:image/png;base64,abc123)');
      const result = rewriteFileLinks(input);
      expect(result.content).toBe('![img](data:image/png;base64,abc123)');
      expect(translated).toEqual([]);
    });

    it('protects file:/// URIs', () => {
      const { input, translated } = noopInput('Open file:///Users/dev/doc.md');
      const result = rewriteFileLinks(input);
      expect(result.content).toBe('Open file:///Users/dev/doc.md');
      expect(translated).toEqual([]);
    });

    it('protects tel: URIs', () => {
      const { input, translated } = noopInput('Call tel:+1234567890');
      const result = rewriteFileLinks(input);
      expect(result.content).toBe('Call tel:+1234567890');
      expect(translated).toEqual([]);
    });

    it('protects URLs with query strings and fragments', () => {
      const content = 'See https://example.com/path?q=1&b=2#section for details';
      const { input, translated } = noopInput(content);
      const result = rewriteFileLinks(input);
      expect(result.content).toBe(content);
      expect(translated).toEqual([]);
    });

    it('protects custom protocol handlers', () => {
      const content = [
        'slack://channel/C123',
        'vscode://vscode.git/clone?url=test',
        'javascript:void(0)',
      ].join('\n');
      const { input, translated } = noopInput(content);
      const result = rewriteFileLinks(input);
      expect(result.content).toBe(content);
      expect(translated).toEqual([]);
    });

    it('protects localhost:port references', () => {
      const content = 'Server at localhost:3000/api and localhost:8080';
      const { input, translated } = noopInput(content);
      const result = rewriteFileLinks(input);
      expect(result.content).toBe(content);
      expect(translated).toEqual([]);
    });

    it('protects URL at end of sentence with trailing period', () => {
      const content = 'Visit https://example.com/docs.';
      const { input, translated } = noopInput(content);
      const result = rewriteFileLinks(input);
      expect(result.content).toBe(content);
      expect(translated).toEqual([]);
    });

    it('protects multiple URLs on the same line', () => {
      const content = 'Use https://a.com/x and ftp://b.com/y for access';
      const { input, translated } = noopInput(content);
      const result = rewriteFileLinks(input);
      expect(result.content).toBe(content);
      expect(translated).toEqual([]);
    });

    it('protects URLs inside markdown link syntax', () => {
      const content = '[docs](https://example.com/docs/guide.md)';
      const { input, translated } = noopInput(content);
      const result = rewriteFileLinks(input);
      expect(result.content).toBe(content);
      expect(translated).toEqual([]);
    });

    it('protects email addresses in prose', () => {
      const content = 'Contact support@company.com or dev+tag@example.org for help';
      const { input, translated } = noopInput(content);
      const result = rewriteFileLinks(input);
      expect(result.content).toBe(content);
      expect(translated).toEqual([]);
    });

    it('does not protect single-letter prefix to avoid swallowing Windows drive letters', () => {
      const result = rewriteFileLinks({
        content: 'Path: `C:\\proj\\src\\handler.ts`',
        projectRoot: 'C:\\proj',
        sourceFile: 'C:\\proj\\.agentsmesh\\rules\\_root.md',
        destinationFile: 'C:\\proj\\CLAUDE.md',
        translatePath: (abs: string) => abs,
        pathExists: (abs: string) => abs === 'C:\\proj\\src\\handler.ts',
      });
      expect(result.content).toBe('Path: `C:\\proj\\src\\handler.ts`');
    });
  });

  describe('code block protection', () => {
    it('protects paths inside tilde-fenced code blocks', () => {
      const content = [
        'Before: `../../docs/guide.md` is here.',
        '~~~',
        'cat ../../docs/guide.md',
        '~~~',
        'After: `../../docs/guide.md` is here.',
      ].join('\n');
      const result = rewriteFileLinks(rewriteInput(content, ['/proj/docs/guide.md']));
      expect(result.content).toContain('Before: `docs/guide.md` is here.');
      expect(result.content).toContain('cat ../../docs/guide.md');
      expect(result.content).toContain('After: `docs/guide.md` is here.');
    });

    it('protects multiple code blocks independently', () => {
      const content = [
        '`../../docs/a.md`',
        '```',
        '../../docs/a.md',
        '```',
        '`../../docs/b.md`',
        '```ts',
        '../../docs/b.md',
        '```',
        '`../../docs/a.md`',
      ].join('\n');
      const result = rewriteFileLinks(
        rewriteInput(content, ['/proj/docs/a.md', '/proj/docs/b.md']),
      );
      const lines = result.content.split('\n');
      expect(lines[0]).toBe('`docs/a.md`');
      expect(lines[2]).toBe('../../docs/a.md');
      expect(lines[4]).toBe('`docs/b.md`');
      expect(lines[6]).toBe('../../docs/b.md');
      expect(lines[8]).toBe('`docs/a.md`');
    });

    it('rewrites multiple inline code spans on the same line', () => {
      const result = rewriteFileLinks(
        rewriteInput('Compare `../../src/a.ts` with `../../src/b.ts` and `../../src/c.ts`', [
          '/proj/src/a.ts',
          '/proj/src/b.ts',
          '/proj/src/c.ts',
        ]),
      );
      expect(result.content).toBe('Compare `src/a.ts` with `src/b.ts` and `src/c.ts`');
    });

    it('handles code block with no language specifier', () => {
      const content = ['```', '../../docs/guide.md', '```'].join('\n');
      const result = rewriteFileLinks(rewriteInput(content, ['/proj/docs/guide.md']));
      expect(result.content).toBe(content);
    });

    it('protects paths inside code block that starts at beginning of content', () => {
      const content = ['```', '../../docs/guide.md', '```', '../../docs/guide.md'].join('\n');
      const result = rewriteFileLinks(rewriteInput(content, ['/proj/docs/guide.md']));
      const lines = result.content.split('\n');
      expect(lines[1]).toBe('../../docs/guide.md');
      expect(lines[3]).toBe('../../docs/guide.md');
    });
  });

  describe('AgentsMesh managed block protection', () => {
    it('does not rewrite paths inside root generation contract blocks', () => {
      const content = [
        'Before ../../docs/guide.md',
        '<!-- agentsmesh:root-generation-contract:start -->',
        'Keep ../../docs/guide.md literal.',
        '<!-- agentsmesh:root-generation-contract:end -->',
        'After ../../docs/guide.md',
      ].join('\n');
      const result = rewriteFileLinks({
        content,
        projectRoot: '/proj',
        sourceFile: '/proj/.agentsmesh/rules/_root.md',
        destinationFile: '/proj/CLAUDE.md',
        translatePath: (abs: string) =>
          abs === '/proj/docs/guide.md' ? '/proj/output/guide.md' : abs,
        pathExists: (abs: string) =>
          abs === '/proj/docs/guide.md' || abs === '/proj/output/guide.md',
        rewriteBarePathTokens: true,
      });
      expect(result.content).toContain('Before output/guide.md');
      expect(result.content).toContain('Keep ../../docs/guide.md literal.');
      expect(result.content).toContain('After output/guide.md');
    });

    it('does not rewrite paths inside embedded rule blocks', () => {
      const content = [
        'Before ../../docs/guide.md',
        '<!-- agentsmesh:embedded-rules:start -->',
        '<!-- agentsmesh:embedded-rule:start {"source":"rules/typescript.md","description":"TS rules","globs":["src/**/*.ts"],"targets":[]} -->',
        'Keep ../../docs/guide.md and rules/typescript.md literal.',
        '<!-- agentsmesh:embedded-rule:end -->',
        '<!-- agentsmesh:embedded-rules:end -->',
        'After ../../docs/guide.md',
      ].join('\n');
      const result = rewriteFileLinks({
        content,
        projectRoot: '/proj',
        sourceFile: '/proj/.agentsmesh/rules/_root.md',
        destinationFile: '/proj/GEMINI.md',
        translatePath: (abs: string) =>
          abs === '/proj/docs/guide.md' ? '/proj/output/guide.md' : abs,
        pathExists: (abs: string) =>
          abs === '/proj/docs/guide.md' ||
          abs === '/proj/output/guide.md' ||
          abs === '/proj/.agentsmesh/rules/typescript.md',
        rewriteBarePathTokens: true,
      });

      expect(result.content).toContain('Before output/guide.md');
      expect(result.content).toContain(
        '<!-- agentsmesh:embedded-rule:start {"source":"rules/typescript.md"',
      );
      expect(result.content).toContain('Keep ../../docs/guide.md and rules/typescript.md literal.');
      expect(result.content).toContain('After output/guide.md');
      expect(result.content).not.toContain('"source":"GEMINI.md"');
    });
  });

  describe('line-number suffix handling', () => {
    it('preserves :0 as a valid line number', () => {
      const result = rewriteFileLinks(rewriteInput('Check src/index.ts:0', ['/proj/src/index.ts']));
      expect(result.content).toBe('Check src/index.ts:0');
    });

    it('preserves large line numbers', () => {
      const result = rewriteFileLinks(
        rewriteInput('See src/big-file.ts:99999', ['/proj/src/big-file.ts']),
      );
      expect(result.content).toBe('See src/big-file.ts:99999');
    });

    it('strips line number then trailing punctuation in correct order', () => {
      const result = rewriteFileLinks(
        rewriteInput('See `../../src/handler.ts:42`.', ['/proj/src/handler.ts']),
      );
      expect(result.content).toBe('See `src/handler.ts:42`.');
    });

    it('does not treat port-like :digits in URLs as line numbers', () => {
      const content = 'API at http://localhost:8080/api';
      const { input, translated } = noopInput(content);
      const result = rewriteFileLinks(input);
      expect(result.content).toBe(content);
      expect(translated).toEqual([]);
    });

    it('handles path:line:col followed by punctuation', () => {
      const result = rewriteFileLinks(
        rewriteInput('Error at `../../src/parser.ts:10:5`!', ['/proj/src/parser.ts']),
      );
      expect(result.content).toBe('Error at `src/parser.ts:10:5`!');
    });
  });

  describe('markdown syntax edge cases', () => {
    it('rewrites path inside markdown image syntax', () => {
      const result = rewriteFileLinks(
        rewriteInput('![diagram](../../docs/arch.png)', ['/proj/docs/arch.png']),
      );
      expect(result.content).toBe('![diagram](docs/arch.png)');
    });

    it('rewrites markdown link destination while link text stays literal', () => {
      const result = rewriteFileLinks(
        rewriteInput('[../../docs/guide.md](../../docs/guide.md)', ['/proj/docs/guide.md']),
      );
      expect(result.content).toBe('[../../docs/guide.md](docs/guide.md)');
    });

    it('stops path token before #fragment', () => {
      const result = rewriteFileLinks(
        rewriteInput('[x](../../docs/guide.md#installation)', ['/proj/docs/guide.md']),
      );
      expect(result.content).toBe('[x](docs/guide.md#installation)');
    });

    it('stops path token before ?query', () => {
      const result = rewriteFileLinks(
        rewriteInput('[x](../../docs/guide.md?v=2)', ['/proj/docs/guide.md']),
      );
      expect(result.content).toBe('[x](docs/guide.md?v=2)');
    });

    it('does not rewrite comma-separated bare paths in prose', () => {
      const result = rewriteFileLinks(
        rewriteInput('Files: ../../src/a.ts, ../../src/b.ts, ../../src/c.ts', [
          '/proj/src/a.ts',
          '/proj/src/b.ts',
          '/proj/src/c.ts',
        ]),
      );
      expect(result.content).toBe('Files: ../../src/a.ts, ../../src/b.ts, ../../src/c.ts');
    });

    it('rewrites comma-separated paths when each is delimited', () => {
      const result = rewriteFileLinks(
        rewriteInput('Files: `../../src/a.ts`, `../../src/b.ts`, `../../src/c.ts`', [
          '/proj/src/a.ts',
          '/proj/src/b.ts',
          '/proj/src/c.ts',
        ]),
      );
      expect(result.content).toBe('Files: `src/a.ts`, `src/b.ts`, `src/c.ts`');
    });

    it('does not rewrite bare path at the very start of content', () => {
      const result = rewriteFileLinks(
        rewriteInput('../../docs/guide.md is the entry', ['/proj/docs/guide.md']),
      );
      expect(result.content).toBe('../../docs/guide.md is the entry');
    });

    it('does not rewrite bare path at the very end of content without punctuation', () => {
      const result = rewriteFileLinks(
        rewriteInput('Entry is ../../docs/guide.md', ['/proj/docs/guide.md']),
      );
      expect(result.content).toBe('Entry is ../../docs/guide.md');
    });

    it('does not rewrite bare path inside parentheses', () => {
      const result = rewriteFileLinks(
        rewriteInput('(see ../../docs/guide.md)', ['/proj/docs/guide.md']),
      );
      expect(result.content).toBe('(see ../../docs/guide.md)');
    });
  });

  describe('bare filename resolution', () => {
    it('resolves bare filename with extension relative to source file directory', () => {
      const result = rewriteFileLinks({
        content: 'See template.ts for the implementation.',
        projectRoot: '/proj',
        sourceFile: '/proj/.agentsmesh/skills/api-gen/SKILL.md',
        destinationFile: '/proj/.claude/skills/api-gen/SKILL.md',
        translatePath: (abs: string) =>
          abs === '/proj/.agentsmesh/skills/api-gen/template.ts'
            ? '/proj/.claude/skills/api-gen/template.ts'
            : abs,
        pathExists: (abs: string) => abs === '/proj/.claude/skills/api-gen/template.ts',
      });
      expect(result.content).toBe('See template.ts for the implementation.');
    });

    it('does not resolve bare filename without extension', () => {
      const { input } = noopInput('See README for the overview.');
      const result = rewriteFileLinks(input);
      expect(result.content).toBe('See README for the overview.');
    });

    it('does not rewrite bare root filenames like AGENTS.md', () => {
      const result = rewriteFileLinks(
        rewriteInput('Generate AGENTS.md and CLAUDE.md for the project.', [
          '/proj/AGENTS.md',
          '/proj/CLAUDE.md',
        ]),
      );
      expect(result.content).toBe('Generate AGENTS.md and CLAUDE.md for the project.');
    });
  });

  describe('empty and trivial content', () => {
    it('handles empty string content', () => {
      const result = rewriteFileLinks(rewriteInput('', []));
      expect(result.content).toBe('');
      expect(result.missing).toEqual([]);
    });

    it('handles whitespace-only content', () => {
      const result = rewriteFileLinks(rewriteInput('   \n\n  ', []));
      expect(result.content).toBe('   \n\n  ');
      expect(result.missing).toEqual([]);
    });

    it('handles content with no path-like tokens', () => {
      const result = rewriteFileLinks(
        rewriteInput('Just a normal sentence with no paths at all.', []),
      );
      expect(result.content).toBe('Just a normal sentence with no paths at all.');
      expect(result.missing).toEqual([]);
    });
  });

  describe('delimiter-only rewriting', () => {
    describe('bare prose is never rewritten', () => {
      it('does not rewrite bare directory name that exists on disk', () => {
        const result = rewriteFileLinks({
          content: 'Look for a scripts/ directory and README index.',
          projectRoot: '/proj',
          sourceFile: '/proj/.agentsmesh/skills/senior-developer/SKILL.md',
          destinationFile: '/proj/.cursor/skills/senior-developer/SKILL.md',
          translatePath: (p) => p,
          pathExists: (p) => p === '/proj/scripts',
        });
        expect(result.content).toBe('Look for a scripts/ directory and README index.');
      });

      it('does not rewrite multiple bare directory names in prose', () => {
        const content =
          'Scripts might be organized by category (database/, git/, api-wrappers/) or just in the root.';
        const result = rewriteFileLinks({
          content,
          projectRoot: '/proj',
          sourceFile: '/proj/.agentsmesh/skills/senior-developer/SKILL.md',
          destinationFile: '/proj/.cursor/skills/senior-developer/SKILL.md',
          translatePath: (p) => p,
          pathExists: () => false,
        });
        expect(result.content).toBe(content);
      });

      it('does not rewrite bare relative path in prose', () => {
        const content = 'See ../../docs/guide.md for the overview.';
        const result = rewriteFileLinks({
          content,
          projectRoot: '/proj',
          sourceFile: '/proj/.agentsmesh/rules/_root.md',
          destinationFile: '/proj/CLAUDE.md',
          translatePath: (p) => p,
          pathExists: (p) => p === '/proj/docs/guide.md',
        });
        expect(result.content).toBe(content);
      });

      it('does not rewrite bare canonical prefix path in prose', () => {
        const content = 'Run agentsmesh generate after editing .agentsmesh/rules/_root.md.';
        const result = rewriteFileLinks({
          content,
          projectRoot: '/proj',
          sourceFile: '/proj/.agentsmesh/rules/_root.md',
          destinationFile: '/proj/CLAUDE.md',
          translatePath: (p) => p,
          pathExists: (p) => p === '/proj/.agentsmesh/rules/_root.md',
        });
        expect(result.content).toBe(content);
      });
    });

    describe('backtick inline code is rewritten', () => {
      it('rewrites path inside backtick span', () => {
        const result = rewriteFileLinks({
          content: 'See `.agentsmesh/commands/review.md` for details.',
          projectRoot: '/proj',
          sourceFile: '/proj/.agentsmesh/rules/_root.md',
          destinationFile: '/proj/CLAUDE.md',
          translatePath: (p) =>
            p === '/proj/.agentsmesh/commands/review.md' ? '/proj/.claude/commands/review.md' : p,
          pathExists: (p) => p === '/proj/.claude/commands/review.md',
        });
        expect(result.content).toBe('See `.agentsmesh/commands/review.md` for details.');
      });

      it('rewrites relative path inside backtick span', () => {
        const result = rewriteFileLinks({
          content: 'Check `../../docs/guide.md` for reference.',
          projectRoot: '/proj',
          sourceFile: '/proj/.agentsmesh/rules/_root.md',
          destinationFile: '/proj/CLAUDE.md',
          translatePath: (p) => p,
          pathExists: (p) => p === '/proj/docs/guide.md',
        });
        expect(result.content).toBe('Check `docs/guide.md` for reference.');
      });

      it('preserves backtick span that is not a path', () => {
        const result = rewriteFileLinks({
          content: 'Use `npm install` and `git commit`.',
          projectRoot: '/proj',
          sourceFile: '/proj/.agentsmesh/rules/_root.md',
          destinationFile: '/proj/CLAUDE.md',
          translatePath: (p) => p,
          pathExists: () => false,
        });
        expect(result.content).toBe('Use `npm install` and `git commit`.');
      });
    });

    describe('quoted strings are rewritten', () => {
      it('rewrites path inside double-quoted string', () => {
        const result = rewriteFileLinks({
          content: 'Path: "../../docs/guide.md".',
          projectRoot: '/proj',
          sourceFile: '/proj/.agentsmesh/rules/_root.md',
          destinationFile: '/proj/CLAUDE.md',
          translatePath: (p) => p,
          pathExists: (p) => p === '/proj/docs/guide.md',
        });
        expect(result.content).toBe('Path: "docs/guide.md".');
      });

      it('rewrites path inside single-quoted string', () => {
        const result = rewriteFileLinks({
          content: "Path: '../../docs/guide.md'.",
          projectRoot: '/proj',
          sourceFile: '/proj/.agentsmesh/rules/_root.md',
          destinationFile: '/proj/CLAUDE.md',
          translatePath: (p) => p,
          pathExists: (p) => p === '/proj/docs/guide.md',
        });
        expect(result.content).toBe("Path: 'docs/guide.md'.");
      });
    });

    describe('@-prefixed tool paths', () => {
      it('rewrites @.agentsmesh/commands path outside explicit delimiters', () => {
        const result = rewriteFileLinks({
          content: 'Run @.agentsmesh/commands/review.md now.',
          projectRoot: '/proj',
          sourceFile: '/proj/.agentsmesh/rules/_root.md',
          destinationFile: '/proj/CLAUDE.md',
          translatePath: (p) =>
            p === '/proj/.agentsmesh/commands/review.md' ? '/proj/.claude/commands/review.md' : p,
          pathExists: (p) => p === '/proj/.claude/commands/review.md',
        });
        expect(result.content).toBe('Run @.agentsmesh/commands/review.md now.');
      });
    });

    describe('markdown link destinations are rewritten', () => {
      it('rewrites path in markdown link destination', () => {
        const result = rewriteFileLinks({
          content: 'See [guide](../../docs/guide.md) for details.',
          projectRoot: '/proj',
          sourceFile: '/proj/.agentsmesh/rules/_root.md',
          destinationFile: '/proj/CLAUDE.md',
          translatePath: (p) => p,
          pathExists: (p) => p === '/proj/docs/guide.md',
        });
        expect(result.content).toBe('See [guide](docs/guide.md) for details.');
      });

      it('rewrites path in markdown image destination', () => {
        const result = rewriteFileLinks({
          content: '![diagram](../../docs/arch.png)',
          projectRoot: '/proj',
          sourceFile: '/proj/.agentsmesh/rules/_root.md',
          destinationFile: '/proj/CLAUDE.md',
          translatePath: (p) => p,
          pathExists: (p) => p === '/proj/docs/arch.png',
        });
        expect(result.content).toBe('![diagram](docs/arch.png)');
      });

      it('rewrites directory-only link destination', () => {
        const result = rewriteFileLinks({
          content: 'See [scripts folder](scripts/) for automation.',
          projectRoot: '/proj',
          sourceFile: '/proj/.agentsmesh/skills/foo/SKILL.md',
          destinationFile: '/proj/.cursor/skills/foo/SKILL.md',
          translatePath: (p) => p,
          pathExists: (p) => p === '/proj/scripts',
        });
        expect(result.content).toBe('See [scripts folder](../../../scripts/) for automation.');
      });

      it('preserves external URL in markdown link destination', () => {
        const result = rewriteFileLinks({
          content: '[docs](https://example.com/docs/guide.md)',
          projectRoot: '/proj',
          sourceFile: '/proj/.agentsmesh/rules/_root.md',
          destinationFile: '/proj/CLAUDE.md',
          translatePath: (p) => p,
          pathExists: () => false,
        });
        expect(result.content).toBe('[docs](https://example.com/docs/guide.md)');
      });

      it('preserves link title in markdown link destination', () => {
        const result = rewriteFileLinks({
          content: '[guide](../../docs/guide.md "The Guide")',
          projectRoot: '/proj',
          sourceFile: '/proj/.agentsmesh/rules/_root.md',
          destinationFile: '/proj/CLAUDE.md',
          translatePath: (p) => p,
          pathExists: (p) => p === '/proj/docs/guide.md',
        });
        expect(result.content).toBe('[guide](docs/guide.md "The Guide")');
      });
    });
  });
});
