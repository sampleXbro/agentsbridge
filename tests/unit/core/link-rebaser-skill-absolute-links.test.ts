import { describe, expect, it } from 'vitest';
import { rewriteFileLinks } from '../../../src/core/reference/link-rebaser.js';

/*
 * Coverage for the case: a skill (`.agentsmesh/skills/<name>/SKILL.md` or any of its
 * supporting files) embeds an *absolute* link to another reference (rule, command,
 * agent, sibling skill, supporting file). The rewriter must convert it to a
 * destination-relative form for the target output, in both project and global scope.
 *
 * Project scope: skill canonicals live at `/proj/.agentsmesh/skills/...`, output
 * lives at `/proj/.claude/skills/...`. Absolute paths point into the project.
 *
 * Global scope: skill canonicals live at `/home/user/.agentsmesh/skills/...`, output
 * lives at `/home/user/.claude/skills/...`. Absolute paths point into the user home.
 */

const PROJECT_ROOT = '/proj';
const HOME_ROOT = '/home/user';

const PROJECT_SKILL_SRC = '/proj/.agentsmesh/skills/qa/SKILL.md';
const PROJECT_SKILL_DEST = '/proj/.claude/skills/qa/SKILL.md';
const PROJECT_SKILL_REF_SRC = '/proj/.agentsmesh/skills/qa/references/checklist.md';
const PROJECT_SKILL_REF_DEST = '/proj/.claude/skills/qa/references/checklist.md';

const GLOBAL_SKILL_SRC = '/home/user/.agentsmesh/skills/qa/SKILL.md';
const GLOBAL_SKILL_DEST = '/home/user/.claude/skills/qa/SKILL.md';
const GLOBAL_SKILL_REF_SRC = '/home/user/.agentsmesh/skills/qa/references/checklist.md';
const GLOBAL_SKILL_REF_DEST = '/home/user/.claude/skills/qa/references/checklist.md';

interface ScopeFixture {
  readonly root: string;
  readonly skillSrc: string;
  readonly skillDest: string;
  readonly skillRefSrc: string;
  readonly skillRefDest: string;
}

const PROJECT_FIXTURE: ScopeFixture = {
  root: PROJECT_ROOT,
  skillSrc: PROJECT_SKILL_SRC,
  skillDest: PROJECT_SKILL_DEST,
  skillRefSrc: PROJECT_SKILL_REF_SRC,
  skillRefDest: PROJECT_SKILL_REF_DEST,
};

const GLOBAL_FIXTURE: ScopeFixture = {
  root: HOME_ROOT,
  skillSrc: GLOBAL_SKILL_SRC,
  skillDest: GLOBAL_SKILL_DEST,
  skillRefSrc: GLOBAL_SKILL_REF_SRC,
  skillRefDest: GLOBAL_SKILL_REF_DEST,
};

function makeMeshArtifactMap(root: string): Map<string, string> {
  return new Map([
    [`${root}/.agentsmesh/rules/typescript.md`, `${root}/.claude/rules/typescript.md`],
    [`${root}/.agentsmesh/rules/_root.md`, `${root}/.claude/CLAUDE.md`],
    [`${root}/.agentsmesh/commands/review.md`, `${root}/.claude/commands/review.md`],
    [`${root}/.agentsmesh/agents/reviewer.md`, `${root}/.claude/agents/reviewer.md`],
    [`${root}/.agentsmesh/skills/qa`, `${root}/.claude/skills/qa`],
    [`${root}/.agentsmesh/skills/qa/SKILL.md`, `${root}/.claude/skills/qa/SKILL.md`],
    [
      `${root}/.agentsmesh/skills/qa/references/checklist.md`,
      `${root}/.claude/skills/qa/references/checklist.md`,
    ],
    [
      `${root}/.agentsmesh/skills/qa/references/extra.md`,
      `${root}/.claude/skills/qa/references/extra.md`,
    ],
    [`${root}/.agentsmesh/skills/release-manager`, `${root}/.claude/skills/release-manager`],
    [
      `${root}/.agentsmesh/skills/release-manager/SKILL.md`,
      `${root}/.claude/skills/release-manager/SKILL.md`,
    ],
  ]);
}

function makeExistingSet(root: string): Set<string> {
  return new Set([
    `${root}/.claude/rules/typescript.md`,
    `${root}/.claude/CLAUDE.md`,
    `${root}/.claude/commands/review.md`,
    `${root}/.claude/agents/reviewer.md`,
    `${root}/.claude/skills/qa`,
    `${root}/.claude/skills/qa/SKILL.md`,
    `${root}/.claude/skills/qa/references/checklist.md`,
    `${root}/.claude/skills/qa/references/extra.md`,
    `${root}/.claude/skills/release-manager`,
    `${root}/.claude/skills/release-manager/SKILL.md`,
    // Outside-mesh disk paths used in non-mesh edge cases.
    `${root}/docs/architecture.md`,
    `${root}/scripts`,
  ]);
}

function makeDirSet(root: string): Set<string> {
  return new Set([
    `${root}/.claude/skills/qa`,
    `${root}/.claude/skills/release-manager`,
    `${root}/.agentsmesh/skills/qa`,
    `${root}/.agentsmesh/skills/release-manager`,
    `${root}/scripts`,
  ]);
}

interface RunInput {
  content: string;
  source: string;
  destination: string;
  scope: 'project' | 'global';
  fixture: ScopeFixture;
}

function run({ content, source, destination, scope, fixture }: RunInput): {
  content: string;
  missing: string[];
} {
  const artifactMap = makeMeshArtifactMap(fixture.root);
  const existing = makeExistingSet(fixture.root);
  const dirs = makeDirSet(fixture.root);
  return rewriteFileLinks({
    content,
    projectRoot: fixture.root,
    sourceFile: source,
    destinationFile: destination,
    translatePath: (abs) => artifactMap.get(abs) ?? abs,
    pathExists: (abs) => existing.has(abs),
    pathIsDirectory: (abs) => dirs.has(abs),
    explicitCurrentDirLinks: true,
    rewriteBarePathTokens: true,
    scope,
  });
}

describe('rewriteFileLinks: skills with absolute links — project scope', () => {
  describe('POSIX absolute paths inside SKILL.md', () => {
    it('rewrites canonical absolute path inside backtick prose to a destination-relative path', () => {
      const result = run({
        content: 'See `/proj/.agentsmesh/rules/typescript.md` for style.',
        source: PROJECT_SKILL_SRC,
        destination: PROJECT_SKILL_DEST,
        scope: 'project',
        fixture: PROJECT_FIXTURE,
      });
      expect(result.content).toBe('See `../../rules/typescript.md` for style.');
      expect(result.missing).toEqual([]);
    });

    it('rewrites canonical absolute path inside markdown link destination', () => {
      const result = run({
        content: 'Check [TS rule](/proj/.agentsmesh/rules/typescript.md).',
        source: PROJECT_SKILL_SRC,
        destination: PROJECT_SKILL_DEST,
        scope: 'project',
        fixture: PROJECT_FIXTURE,
      });
      expect(result.content).toBe('Check [TS rule](../../rules/typescript.md).');
      expect(result.missing).toEqual([]);
    });

    it('rewrites canonical absolute path inside markdown image destination', () => {
      const result = run({
        content: '![diagram](/proj/.agentsmesh/skills/qa/references/extra.md)',
        source: PROJECT_SKILL_SRC,
        destination: PROJECT_SKILL_DEST,
        scope: 'project',
        fixture: PROJECT_FIXTURE,
      });
      expect(result.content).toBe('![diagram](./references/extra.md)');
      expect(result.missing).toEqual([]);
    });

    it('rewrites canonical absolute path to a sibling reference file (same-skill)', () => {
      const result = run({
        content: 'Checklist: `/proj/.agentsmesh/skills/qa/references/checklist.md`.',
        source: PROJECT_SKILL_SRC,
        destination: PROJECT_SKILL_DEST,
        scope: 'project',
        fixture: PROJECT_FIXTURE,
      });
      expect(result.content).toBe('Checklist: `./references/checklist.md`.');
      expect(result.missing).toEqual([]);
    });

    it('rewrites canonical absolute path to a different skill (cross-skill reference)', () => {
      const result = run({
        content: 'See [release manager](/proj/.agentsmesh/skills/release-manager/SKILL.md).',
        source: PROJECT_SKILL_SRC,
        destination: PROJECT_SKILL_DEST,
        scope: 'project',
        fixture: PROJECT_FIXTURE,
      });
      expect(result.content).toBe('See [release manager](../release-manager/SKILL.md).');
      expect(result.missing).toEqual([]);
    });

    it('rewrites canonical absolute path to a directory (trailing slash)', () => {
      const result = run({
        content: 'Look in [release manager skill](/proj/.agentsmesh/skills/release-manager/).',
        source: PROJECT_SKILL_SRC,
        destination: PROJECT_SKILL_DEST,
        scope: 'project',
        fixture: PROJECT_FIXTURE,
      });
      expect(result.content).toBe('Look in [release manager skill](../release-manager/).');
      expect(result.missing).toEqual([]);
    });

    it('rewrites canonical absolute path with line-number suffix', () => {
      const result = run({
        content: 'Failure at `/proj/.agentsmesh/rules/typescript.md:42`.',
        source: PROJECT_SKILL_SRC,
        destination: PROJECT_SKILL_DEST,
        scope: 'project',
        fixture: PROJECT_FIXTURE,
      });
      expect(result.content).toBe('Failure at `../../rules/typescript.md:42`.');
      expect(result.missing).toEqual([]);
    });

    it('rewrites canonical absolute path with line:col suffix', () => {
      const result = run({
        content: 'Failure at `/proj/.agentsmesh/rules/typescript.md:42:7`.',
        source: PROJECT_SKILL_SRC,
        destination: PROJECT_SKILL_DEST,
        scope: 'project',
        fixture: PROJECT_FIXTURE,
      });
      expect(result.content).toBe('Failure at `../../rules/typescript.md:42:7`.');
      expect(result.missing).toEqual([]);
    });

    it('rewrites canonical absolute path with #fragment suffix preserved', () => {
      const result = run({
        content: 'See [section](/proj/.agentsmesh/rules/typescript.md#strict-mode).',
        source: PROJECT_SKILL_SRC,
        destination: PROJECT_SKILL_DEST,
        scope: 'project',
        fixture: PROJECT_FIXTURE,
      });
      expect(result.content).toBe('See [section](../../rules/typescript.md#strict-mode).');
      expect(result.missing).toEqual([]);
    });

    it('rewrites canonical absolute path with ?query suffix preserved', () => {
      const result = run({
        content: 'See [section](/proj/.agentsmesh/rules/typescript.md?v=2).',
        source: PROJECT_SKILL_SRC,
        destination: PROJECT_SKILL_DEST,
        scope: 'project',
        fixture: PROJECT_FIXTURE,
      });
      expect(result.content).toBe('See [section](../../rules/typescript.md?v=2).');
      expect(result.missing).toEqual([]);
    });
  });

  describe('POSIX absolute paths inside skill supporting files', () => {
    it('rewrites canonical absolute path from a supporting file (references/checklist.md)', () => {
      const result = run({
        content: 'Back to [SKILL](/proj/.agentsmesh/skills/qa/SKILL.md).',
        source: PROJECT_SKILL_REF_SRC,
        destination: PROJECT_SKILL_REF_DEST,
        scope: 'project',
        fixture: PROJECT_FIXTURE,
      });
      expect(result.content).toBe('Back to [SKILL](../SKILL.md).');
      expect(result.missing).toEqual([]);
    });

    it('rewrites supporting-file absolute path to a sibling reference', () => {
      const result = run({
        content: 'See `/proj/.agentsmesh/skills/qa/references/extra.md`.',
        source: PROJECT_SKILL_REF_SRC,
        destination: PROJECT_SKILL_REF_DEST,
        scope: 'project',
        fixture: PROJECT_FIXTURE,
      });
      expect(result.content).toBe('See `./extra.md`.');
      expect(result.missing).toEqual([]);
    });
  });

  describe('protected contexts must not rewrite absolute paths', () => {
    it('preserves a POSIX absolute path inside a fenced code block', () => {
      const content = ['```', '/proj/.agentsmesh/rules/typescript.md', '```'].join('\n');
      const result = run({
        content,
        source: PROJECT_SKILL_SRC,
        destination: PROJECT_SKILL_DEST,
        scope: 'project',
        fixture: PROJECT_FIXTURE,
      });
      expect(result.content).toBe(content);
      expect(result.missing).toEqual([]);
    });

    it('preserves a `file://` URI even when the URL points inside .agentsmesh', () => {
      const content = 'Open file:///proj/.agentsmesh/rules/typescript.md for inspection.';
      const result = run({
        content,
        source: PROJECT_SKILL_SRC,
        destination: PROJECT_SKILL_DEST,
        scope: 'project',
        fixture: PROJECT_FIXTURE,
      });
      expect(result.content).toBe(content);
    });

    it('preserves an https URL even when its path mirrors an .agentsmesh path', () => {
      const content = 'Source: https://example.com/proj/.agentsmesh/rules/typescript.md';
      const result = run({
        content,
        source: PROJECT_SKILL_SRC,
        destination: PROJECT_SKILL_DEST,
        scope: 'project',
        fixture: PROJECT_FIXTURE,
      });
      expect(result.content).toBe(content);
    });
  });

  describe('non-existent absolute paths in skills', () => {
    // The rewriter is intentionally conservative: when a token does not resolve to any
    // existing file, it is left untouched. For markdown link destinations and
    // reference-style definitions the post-generate validator
    // (`validateGeneratedMarkdownLinks`) catches this and fails the build — see
    // `link-rebaser-skill-absolute-links.validator.test.ts` for that contract.
    // Inline-code/backtick prose paths are not validated, so they pass through silently.
    it('leaves a backtick-prose absolute path unchanged when nothing resolves on disk or in the artifact map', () => {
      const content = 'Missing: `/proj/.agentsmesh/rules/missing.md`.';
      const result = run({
        content,
        source: PROJECT_SKILL_SRC,
        destination: PROJECT_SKILL_DEST,
        scope: 'project',
        fixture: PROJECT_FIXTURE,
      });
      expect(result.content).toBe(content);
    });

    it('leaves a markdown-destination absolute path unchanged when it does not resolve (validator catches it later)', () => {
      const content = 'See [missing rule](/proj/.agentsmesh/rules/missing.md).';
      const result = run({
        content,
        source: PROJECT_SKILL_SRC,
        destination: PROJECT_SKILL_DEST,
        scope: 'project',
        fixture: PROJECT_FIXTURE,
      });
      expect(result.content).toBe(content);
    });
  });

  describe('Windows absolute paths in skills', () => {
    it('preserves a Windows absolute path inside backtick prose (out-of-band, not a markdown destination)', () => {
      const content = 'Path: `C:\\proj\\.agentsmesh\\rules\\typescript.md`.';
      const result = run({
        content,
        source: PROJECT_SKILL_SRC,
        destination: PROJECT_SKILL_DEST,
        scope: 'project',
        fixture: PROJECT_FIXTURE,
      });
      expect(result.content).toBe(content);
    });
  });

  describe('root-relative absolute paths in skills', () => {
    it('rewrites a `/.agentsmesh/...` root-relative token to a destination-relative path', () => {
      const result = run({
        content: 'See `/.agentsmesh/rules/typescript.md`.',
        source: PROJECT_SKILL_SRC,
        destination: PROJECT_SKILL_DEST,
        scope: 'project',
        fixture: PROJECT_FIXTURE,
      });
      expect(result.content).toBe('See `../../rules/typescript.md`.');
      expect(result.missing).toEqual([]);
    });
  });

  describe('multiple absolute links on the same line', () => {
    it('rewrites every absolute path inside its own backtick span', () => {
      const result = run({
        content:
          'Both `/proj/.agentsmesh/rules/typescript.md` and `/proj/.agentsmesh/commands/review.md` apply.',
        source: PROJECT_SKILL_SRC,
        destination: PROJECT_SKILL_DEST,
        scope: 'project',
        fixture: PROJECT_FIXTURE,
      });
      expect(result.content).toBe(
        'Both `../../rules/typescript.md` and `../../commands/review.md` apply.',
      );
      expect(result.missing).toEqual([]);
    });
  });
});

describe('rewriteFileLinks: skills with absolute links — global scope', () => {
  describe('POSIX absolute paths inside SKILL.md (HOME-rooted)', () => {
    it('rewrites HOME-rooted canonical absolute path inside backtick prose', () => {
      const result = run({
        content: 'See `/home/user/.agentsmesh/rules/typescript.md` for style.',
        source: GLOBAL_SKILL_SRC,
        destination: GLOBAL_SKILL_DEST,
        scope: 'global',
        fixture: GLOBAL_FIXTURE,
      });
      expect(result.content).toBe('See `../../rules/typescript.md` for style.');
      expect(result.missing).toEqual([]);
    });

    it('rewrites HOME-rooted absolute path inside markdown link destination', () => {
      const result = run({
        content: 'Check [TS rule](/home/user/.agentsmesh/rules/typescript.md).',
        source: GLOBAL_SKILL_SRC,
        destination: GLOBAL_SKILL_DEST,
        scope: 'global',
        fixture: GLOBAL_FIXTURE,
      });
      expect(result.content).toBe('Check [TS rule](../../rules/typescript.md).');
      expect(result.missing).toEqual([]);
    });

    it('rewrites HOME-rooted absolute path to a sibling reference file (same-skill)', () => {
      const result = run({
        content: 'Checklist: `/home/user/.agentsmesh/skills/qa/references/checklist.md`.',
        source: GLOBAL_SKILL_SRC,
        destination: GLOBAL_SKILL_DEST,
        scope: 'global',
        fixture: GLOBAL_FIXTURE,
      });
      expect(result.content).toBe('Checklist: `./references/checklist.md`.');
      expect(result.missing).toEqual([]);
    });

    it('rewrites HOME-rooted absolute path to a cross-skill SKILL.md', () => {
      const result = run({
        content: 'See [release manager](/home/user/.agentsmesh/skills/release-manager/SKILL.md).',
        source: GLOBAL_SKILL_SRC,
        destination: GLOBAL_SKILL_DEST,
        scope: 'global',
        fixture: GLOBAL_FIXTURE,
      });
      expect(result.content).toBe('See [release manager](../release-manager/SKILL.md).');
      expect(result.missing).toEqual([]);
    });

    it('rewrites HOME-rooted absolute path to a skill directory', () => {
      const result = run({
        content: 'Look in [release manager skill](/home/user/.agentsmesh/skills/release-manager/).',
        source: GLOBAL_SKILL_SRC,
        destination: GLOBAL_SKILL_DEST,
        scope: 'global',
        fixture: GLOBAL_FIXTURE,
      });
      expect(result.content).toBe('Look in [release manager skill](../release-manager/).');
      expect(result.missing).toEqual([]);
    });

    it('rewrites HOME-rooted absolute path with line-number suffix', () => {
      const result = run({
        content: 'Failure at `/home/user/.agentsmesh/rules/typescript.md:42`.',
        source: GLOBAL_SKILL_SRC,
        destination: GLOBAL_SKILL_DEST,
        scope: 'global',
        fixture: GLOBAL_FIXTURE,
      });
      expect(result.content).toBe('Failure at `../../rules/typescript.md:42`.');
      expect(result.missing).toEqual([]);
    });

    it('rewrites HOME-rooted absolute path with #fragment preserved', () => {
      const result = run({
        content: 'See [section](/home/user/.agentsmesh/rules/typescript.md#strict-mode).',
        source: GLOBAL_SKILL_SRC,
        destination: GLOBAL_SKILL_DEST,
        scope: 'global',
        fixture: GLOBAL_FIXTURE,
      });
      expect(result.content).toBe('See [section](../../rules/typescript.md#strict-mode).');
      expect(result.missing).toEqual([]);
    });
  });

  describe('POSIX absolute paths inside skill supporting files (HOME-rooted)', () => {
    it('rewrites supporting-file HOME-rooted absolute path back to its SKILL.md', () => {
      const result = run({
        content: 'Back to [SKILL](/home/user/.agentsmesh/skills/qa/SKILL.md).',
        source: GLOBAL_SKILL_REF_SRC,
        destination: GLOBAL_SKILL_REF_DEST,
        scope: 'global',
        fixture: GLOBAL_FIXTURE,
      });
      expect(result.content).toBe('Back to [SKILL](../SKILL.md).');
      expect(result.missing).toEqual([]);
    });

    it('rewrites supporting-file HOME-rooted absolute path to a sibling reference', () => {
      const result = run({
        content: 'See `/home/user/.agentsmesh/skills/qa/references/extra.md`.',
        source: GLOBAL_SKILL_REF_SRC,
        destination: GLOBAL_SKILL_REF_DEST,
        scope: 'global',
        fixture: GLOBAL_FIXTURE,
      });
      expect(result.content).toBe('See `./extra.md`.');
      expect(result.missing).toEqual([]);
    });
  });

  describe('protected contexts must not rewrite absolute paths in global scope', () => {
    it('preserves a HOME-rooted absolute path inside a fenced code block', () => {
      const content = ['```', '/home/user/.agentsmesh/rules/typescript.md', '```'].join('\n');
      const result = run({
        content,
        source: GLOBAL_SKILL_SRC,
        destination: GLOBAL_SKILL_DEST,
        scope: 'global',
        fixture: GLOBAL_FIXTURE,
      });
      expect(result.content).toBe(content);
    });

    it('preserves a `file://` URI in global scope', () => {
      const content = 'Open file:///home/user/.agentsmesh/rules/typescript.md for inspection.';
      const result = run({
        content,
        source: GLOBAL_SKILL_SRC,
        destination: GLOBAL_SKILL_DEST,
        scope: 'global',
        fixture: GLOBAL_FIXTURE,
      });
      expect(result.content).toBe(content);
    });

    it('preserves an https URL whose path mirrors an .agentsmesh path in global scope', () => {
      const content = 'Source: https://example.com/home/user/.agentsmesh/rules/typescript.md';
      const result = run({
        content,
        source: GLOBAL_SKILL_SRC,
        destination: GLOBAL_SKILL_DEST,
        scope: 'global',
        fixture: GLOBAL_FIXTURE,
      });
      expect(result.content).toBe(content);
    });
  });

  describe('global scope leaves non-mesh absolute paths alone', () => {
    it('does not rewrite an absolute path that resolves outside `.agentsmesh/`', () => {
      const content = 'Project doc: `/home/user/docs/architecture.md`.';
      const result = run({
        content,
        source: GLOBAL_SKILL_SRC,
        destination: GLOBAL_SKILL_DEST,
        scope: 'global',
        fixture: GLOBAL_FIXTURE,
      });
      expect(result.content).toBe(content);
    });
  });

  describe('multiple absolute links on one line — global scope', () => {
    it('rewrites every HOME-rooted absolute path inside its own backtick span', () => {
      const result = run({
        content:
          'Both `/home/user/.agentsmesh/rules/typescript.md` and `/home/user/.agentsmesh/commands/review.md` apply.',
        source: GLOBAL_SKILL_SRC,
        destination: GLOBAL_SKILL_DEST,
        scope: 'global',
        fixture: GLOBAL_FIXTURE,
      });
      expect(result.content).toBe(
        'Both `../../rules/typescript.md` and `../../commands/review.md` apply.',
      );
      expect(result.missing).toEqual([]);
    });
  });
});
