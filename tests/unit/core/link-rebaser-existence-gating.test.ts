import { describe, expect, it } from 'vitest';
import { rewriteFileLinks } from '../../../src/core/reference/link-rebaser.js';

/*
 * Existence-gating contract for `rewriteFileLinks`.
 *
 * Invariant: a token is rewritten ONLY when its resolved target exists — either
 * the canonical resolved path, or the translated tool-side path (modeling a
 * planned output). When NEITHER exists, the token MUST be left untouched.
 *
 * This invariant applies uniformly across every link form, including internal
 * `.agentsmesh/...` links: canonical-relative, source-relative, POSIX absolute,
 * root-relative.
 *
 * Notes on the WHEN-EXISTS shape (what changes when a target IS present):
 *  - All tokens (including canonical `.agentsmesh/...` in reading contexts)
 *    are rewritten to destination-relative paths when their target exists.
 *  - Absolute paths and root-relative paths are always rewritten to relative
 *    when they resolve.
 *
 * The tests below pin the EXISTENCE GATE in isolation: each case runs the same
 * content against four existence states (canonical-only, translated-only, both,
 * neither). When `existing === 'neither'`, the result MUST equal the input.
 */

interface ScopeFixture {
  readonly label: 'project' | 'global';
  readonly root: string;
  readonly skillSrc: string;
  readonly skillDest: string;
}

const PROJECT: ScopeFixture = {
  label: 'project',
  root: '/proj',
  skillSrc: '/proj/.agentsmesh/skills/qa/SKILL.md',
  skillDest: '/proj/.claude/skills/qa/SKILL.md',
};

const GLOBAL: ScopeFixture = {
  label: 'global',
  root: '/home/user',
  skillSrc: '/home/user/.agentsmesh/skills/qa/SKILL.md',
  skillDest: '/home/user/.claude/skills/qa/SKILL.md',
};

interface LinkForm {
  readonly name: string;
  readonly tokenFor: (root: string) => string;
  readonly canonicalAbs: (root: string) => string;
  readonly translatedAbs: (root: string) => string;
}

const LINK_FORMS: readonly LinkForm[] = [
  {
    name: 'canonical relative `.agentsmesh/rules/typescript.md`',
    tokenFor: () => '.agentsmesh/rules/typescript.md',
    canonicalAbs: (root) => `${root}/.agentsmesh/rules/typescript.md`,
    translatedAbs: (root) => `${root}/.claude/rules/typescript.md`,
  },
  {
    name: 'canonical relative `.agentsmesh/commands/review.md`',
    tokenFor: () => '.agentsmesh/commands/review.md',
    canonicalAbs: (root) => `${root}/.agentsmesh/commands/review.md`,
    translatedAbs: (root) => `${root}/.claude/commands/review.md`,
  },
  {
    name: 'canonical relative `.agentsmesh/agents/reviewer.md`',
    tokenFor: () => '.agentsmesh/agents/reviewer.md',
    canonicalAbs: (root) => `${root}/.agentsmesh/agents/reviewer.md`,
    translatedAbs: (root) => `${root}/.claude/agents/reviewer.md`,
  },
  {
    name: 'canonical cross-skill `.agentsmesh/skills/<name>/SKILL.md`',
    tokenFor: () => '.agentsmesh/skills/release-manager/SKILL.md',
    canonicalAbs: (root) => `${root}/.agentsmesh/skills/release-manager/SKILL.md`,
    translatedAbs: (root) => `${root}/.claude/skills/release-manager/SKILL.md`,
  },
  {
    name: 'POSIX absolute `<root>/.agentsmesh/rules/typescript.md`',
    tokenFor: (root) => `${root}/.agentsmesh/rules/typescript.md`,
    canonicalAbs: (root) => `${root}/.agentsmesh/rules/typescript.md`,
    translatedAbs: (root) => `${root}/.claude/rules/typescript.md`,
  },
  {
    name: 'root-relative `/.agentsmesh/rules/typescript.md`',
    tokenFor: () => '/.agentsmesh/rules/typescript.md',
    canonicalAbs: (root) => `${root}/.agentsmesh/rules/typescript.md`,
    translatedAbs: (root) => `${root}/.claude/rules/typescript.md`,
  },
  {
    name: 'POSIX absolute cross-skill `<root>/.agentsmesh/skills/<name>/SKILL.md`',
    tokenFor: (root) => `${root}/.agentsmesh/skills/release-manager/SKILL.md`,
    canonicalAbs: (root) => `${root}/.agentsmesh/skills/release-manager/SKILL.md`,
    translatedAbs: (root) => `${root}/.claude/skills/release-manager/SKILL.md`,
  },
];

interface RunInput {
  readonly content: string;
  readonly fixture: ScopeFixture;
  readonly canonicalAbs: string;
  readonly translatedAbs: string;
  readonly existing: 'canonical' | 'translated' | 'both' | 'neither';
}

function runRewrite({ content, fixture, canonicalAbs, translatedAbs, existing }: RunInput): string {
  const existingSet = new Set<string>();
  if (existing === 'canonical' || existing === 'both') existingSet.add(canonicalAbs);
  if (existing === 'translated' || existing === 'both') existingSet.add(translatedAbs);

  return rewriteFileLinks({
    content,
    projectRoot: fixture.root,
    sourceFile: fixture.skillSrc,
    destinationFile: fixture.skillDest,
    translatePath: (abs) => (abs === canonicalAbs ? translatedAbs : abs),
    pathExists: (abs) => existingSet.has(abs),
    explicitCurrentDirLinks: true,
    rewriteBarePathTokens: true,
    scope: fixture.label,
  }).content;
}

describe('rewriteFileLinks: existence-gate contract — every form preserves the original when target is missing', () => {
  for (const fixture of [PROJECT, GLOBAL] as const) {
    describe(`${fixture.label} scope`, () => {
      describe.each(LINK_FORMS)('$name', (form) => {
        const token = form.tokenFor(fixture.root);
        const canonicalAbs = form.canonicalAbs(fixture.root);
        const translatedAbs = form.translatedAbs(fixture.root);

        const backtick = `Ref: \`${token}\`.`;
        const markdown = `Ref: [link](${token}).`;

        it('leaves a backtick-prose token untouched when NEITHER target exists', () => {
          const out = runRewrite({
            content: backtick,
            fixture,
            canonicalAbs,
            translatedAbs,
            existing: 'neither',
          });
          expect(out).toBe(backtick);
        });

        it('leaves a markdown-destination token untouched when NEITHER target exists', () => {
          const out = runRewrite({
            content: markdown,
            fixture,
            canonicalAbs,
            translatedAbs,
            existing: 'neither',
          });
          expect(out).toBe(markdown);
        });

        it('rewrites a markdown destination when the canonical target exists on disk', () => {
          const out = runRewrite({
            content: markdown,
            fixture,
            canonicalAbs,
            translatedAbs,
            existing: 'canonical',
          });
          // The exact relative form depends on token shape, but the canonical
          // path must be gone from the rendered destination.
          expect(out).not.toBe(markdown);
          expect(out).not.toContain(canonicalAbs);
          expect(out).not.toContain('/.agentsmesh/');
        });

        it('rewrites a markdown destination when the translated target exists (planned output)', () => {
          const out = runRewrite({
            content: markdown,
            fixture,
            canonicalAbs,
            translatedAbs,
            existing: 'translated',
          });
          expect(out).not.toBe(markdown);
          expect(out).not.toContain(canonicalAbs);
        });

        it('rewrites a markdown destination when both targets exist', () => {
          const out = runRewrite({
            content: markdown,
            fixture,
            canonicalAbs,
            translatedAbs,
            existing: 'both',
          });
          expect(out).not.toBe(markdown);
        });
      });
    });
  }

  describe('mixed content: rewrites only the existent links and leaves missing ones untouched', () => {
    it('preserves a missing canonical-relative link side-by-side with an existent one (project scope, markdown destinations)', () => {
      const fixture = PROJECT;
      const goodCanonical = `${fixture.root}/.agentsmesh/rules/typescript.md`;
      const goodTranslated = `${fixture.root}/.claude/rules/typescript.md`;
      const missingCanonical = `${fixture.root}/.agentsmesh/rules/missing.md`;
      const missingTranslated = `${fixture.root}/.claude/rules/missing.md`;

      const content = [
        '[ok](.agentsmesh/rules/typescript.md)',
        '[bad](.agentsmesh/rules/missing.md)',
      ].join('\n');

      const out = rewriteFileLinks({
        content,
        projectRoot: fixture.root,
        sourceFile: fixture.skillSrc,
        destinationFile: fixture.skillDest,
        translatePath: (abs) => {
          if (abs === goodCanonical) return goodTranslated;
          if (abs === missingCanonical) return missingTranslated;
          return abs;
        },
        pathExists: (abs) => abs === goodTranslated,
        explicitCurrentDirLinks: true,
        rewriteBarePathTokens: true,
        scope: 'project',
      }).content;

      expect(out).toBe(
        ['[ok](../../rules/typescript.md)', '[bad](.agentsmesh/rules/missing.md)'].join('\n'),
      );
    });

    it('preserves a missing absolute link side-by-side with an existent absolute link (global scope)', () => {
      const fixture = GLOBAL;
      const goodCanonical = `${fixture.root}/.agentsmesh/rules/typescript.md`;
      const goodTranslated = `${fixture.root}/.claude/rules/typescript.md`;
      const missingCanonical = `${fixture.root}/.agentsmesh/rules/missing.md`;
      const missingTranslated = `${fixture.root}/.claude/rules/missing.md`;

      const content = [`[ok](${goodCanonical})`, `[bad](${missingCanonical})`].join('\n');

      const out = rewriteFileLinks({
        content,
        projectRoot: fixture.root,
        sourceFile: fixture.skillSrc,
        destinationFile: fixture.skillDest,
        translatePath: (abs) => {
          if (abs === goodCanonical) return goodTranslated;
          if (abs === missingCanonical) return missingTranslated;
          return abs;
        },
        pathExists: (abs) => abs === goodTranslated,
        explicitCurrentDirLinks: true,
        rewriteBarePathTokens: true,
        scope: 'global',
      }).content;

      expect(out).toBe(
        ['[ok](../../rules/typescript.md)', `[bad](${missingCanonical})`].join('\n'),
      );
    });

    it('reports the unresolved markdown-destination target in the missing[] array', () => {
      const fixture = PROJECT;
      const missingCanonical = `${fixture.root}/.agentsmesh/rules/missing.md`;
      const missingTranslated = `${fixture.root}/.claude/rules/missing.md`;

      const result = rewriteFileLinks({
        content: '[link](.agentsmesh/rules/missing.md)',
        projectRoot: fixture.root,
        sourceFile: fixture.skillSrc,
        destinationFile: fixture.skillDest,
        translatePath: (abs) => (abs === missingCanonical ? missingTranslated : abs),
        pathExists: () => false,
        explicitCurrentDirLinks: true,
        rewriteBarePathTokens: true,
        scope: 'project',
      });

      expect(result.content).toBe('[link](.agentsmesh/rules/missing.md)');
      expect(result.missing).toContain(missingTranslated);
    });
  });
});
