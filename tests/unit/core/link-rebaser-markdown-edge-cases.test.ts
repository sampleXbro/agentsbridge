import { describe, expect, it } from 'vitest';
import { rewriteFileLinks } from '../../../src/core/reference/link-rebaser.js';

const projectRoot = '/proj';

function qaTranslate(p: string): string {
  if (p === '/proj/.agentsmesh/skills/qa') return '/proj/.claude/skills/qa';
  if (p === '/proj/.agentsmesh/skills/qa/references/checklist.md') {
    return '/proj/.claude/skills/qa/references/checklist.md';
  }
  return p;
}

function qaExists(p: string): boolean {
  return p === '/proj/.claude/skills/qa' || p === '/proj/.claude/skills/qa/references/checklist.md';
}

describe('rewriteFileLinks markdown edge cases', () => {
  describe('project scope', () => {
    it('rewrites markdown destinations with surrounding whitespace to the colocated target counterpart', () => {
      // Whitespace inside `()` is not parsed as a markdown link destination by
      // strict CommonMark, so the token falls through to the prose path. With
      // the canonical-anchor → colocated-target contract, the bare
      // `.agentsmesh/skills/qa/` rewrites to `.claude/skills/qa/`.
      const result = rewriteFileLinks({
        content: 'Open [QA](  .agentsmesh/skills/qa/  ).',
        projectRoot,
        sourceFile: '/proj/.agentsmesh/rules/_root.md',
        destinationFile: '/proj/.claude/skills/qa/SKILL.md',
        translatePath: qaTranslate,
        pathExists: qaExists,
        pathIsDirectory: (p) => p === '/proj/.claude/skills/qa',
        rewriteBarePathTokens: true,
        explicitCurrentDirLinks: true,
      });

      expect(result.content).toBe('Open [QA](  .claude/skills/qa/  ).');
    });

    it('rewrites markdown destination while preserving a link title', () => {
      const result = rewriteFileLinks({
        content: 'Open [QA](.agentsmesh/skills/qa/ "Title").',
        projectRoot,
        sourceFile: '/proj/.agentsmesh/rules/_root.md',
        destinationFile: '/proj/.claude/skills/qa/SKILL.md',
        translatePath: qaTranslate,
        pathExists: qaExists,
        pathIsDirectory: (p) => p === '/proj/.claude/skills/qa',
        rewriteBarePathTokens: true,
        explicitCurrentDirLinks: true,
      });

      expect(result.content).toBe('Open [QA](./ "Title").');
    });

    it('rewrites markdown image destinations to destination-relative paths', () => {
      const result = rewriteFileLinks({
        content: '![Checklist](.agentsmesh/skills/qa/references/checklist.md)',
        projectRoot,
        sourceFile: '/proj/.agentsmesh/skills/qa/SKILL.md',
        destinationFile: '/proj/.claude/skills/qa/SKILL.md',
        translatePath: qaTranslate,
        pathExists: qaExists,
        rewriteBarePathTokens: true,
        explicitCurrentDirLinks: true,
      });

      expect(result.content).toBe('![Checklist](./references/checklist.md)');
    });

    it('rewrites bracketed autolink-like `.agentsmesh/` anchors to colocated target counterparts', () => {
      // The deeper `.agentsmesh/skills/qa/references/` directory has no per-target
      // counterpart in this fixture, so it stays anchored at the canonical mesh
      // path. The translated `.agentsmesh/skills/qa/` projects to `.claude/skills/qa/`.
      const result = rewriteFileLinks({
        content: 'See <.agentsmesh/skills/qa/> and <.agentsmesh/skills/qa/references/>.',
        projectRoot,
        sourceFile: '/proj/.agentsmesh/rules/_root.md',
        destinationFile: '/proj/.claude/CLAUDE.md',
        translatePath: qaTranslate,
        pathExists: qaExists,
        rewriteBarePathTokens: true,
      });

      expect(result.content).toBe(
        'See <.claude/skills/qa/> and <.agentsmesh/skills/qa/references/>.',
      );
    });

    it('rewrites reference-style link definition destinations like inline markdown links', () => {
      const result = rewriteFileLinks({
        content: ['See [QA][qa].', '', '[qa]: .agentsmesh/skills/qa/'].join('\n'),
        projectRoot,
        sourceFile: '/proj/.agentsmesh/rules/_root.md',
        destinationFile: '/proj/.claude/CLAUDE.md',
        translatePath: qaTranslate,
        pathExists: qaExists,
        rewriteBarePathTokens: true,
      });

      expect(result.content).toBe(['See [QA][qa].', '', '[qa]: ./skills/qa/'].join('\n'));
    });

    it('does not rewrite markdown destinations that include parentheses in the filename (unsupported token shape)', () => {
      const content = 'Read [doc](docs/foo(bar).md).';
      const result = rewriteFileLinks({
        content,
        projectRoot,
        sourceFile: '/proj/.agentsmesh/rules/_root.md',
        destinationFile: '/proj/.claude/CLAUDE.md',
        translatePath: (p) => p,
        pathExists: () => false,
        rewriteBarePathTokens: true,
        explicitCurrentDirLinks: true,
      });

      expect(result.content).toBe(content);
    });
  });

  describe('global scope', () => {
    it('rewrites markdown destinations to destination-relative paths in global scope too', () => {
      const result = rewriteFileLinks({
        content: 'Open [QA](.agentsmesh/skills/qa/).',
        projectRoot: '/home/user',
        sourceFile: '/home/user/.agentsmesh/rules/_root.md',
        destinationFile: '/home/user/.claude/CLAUDE.md',
        translatePath: (p) =>
          p === '/home/user/.agentsmesh/skills/qa' ? '/home/user/.claude/skills/qa' : p,
        pathExists: (p) => p === '/home/user/.claude/skills/qa',
        pathIsDirectory: (p) => p === '/home/user/.claude/skills/qa',
        rewriteBarePathTokens: true,
        scope: 'global',
      });

      expect(result.content).toBe('Open [QA](./skills/qa/).');
    });
  });
});
