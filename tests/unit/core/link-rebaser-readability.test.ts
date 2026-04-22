/**
 * Readability acceptance tests for the link rebaser — §5 of docs/architecture/link-rebaser-vision.md.
 *
 * These tests assert that well-known anchors (`.agentsmesh/`) are preserved in generated output
 * rather than collapsed to ambiguous `./` or `./...` forms.
 */
import { describe, expect, it } from 'vitest';
import { rewriteFileLinks } from '../../../src/core/reference/link-rebaser.js';

const projectRoot = '/proj';
const sourceFile = '/proj/.agentsmesh/skills/add-agent-target/SKILL.md';
const destinationFile = '/proj/.claude/skills/add-agent-target/SKILL.md';

/** Identity translate — the mesh root itself has no artifact mapping. */
const identityTranslate = (p: string): string => p;

/** Only `.agentsmesh` exists on disk for these anchor-preservation tests. */
const meshRootExists = (p: string): boolean =>
  p === '/proj/.agentsmesh' || p === '/proj/.agentsmesh/';

describe('link-rebaser anchor preservation (I1)', () => {
  describe('.agentsmesh/ root directory in inline-code prose', () => {
    it('preserves .agentsmesh/ when the token IS the mesh root directory', () => {
      const result = rewriteFileLinks({
        content: 'Edit files inside `.agentsmesh/` directly.',
        projectRoot,
        sourceFile,
        destinationFile,
        translatePath: identityTranslate,
        pathExists: meshRootExists,
        rewriteBarePathTokens: true,
      });

      expect(result.content).toBe('Edit files inside `.agentsmesh/` directly.');
    });

    it('preserves .agentsmesh/... ellipsis documentation reference', () => {
      const result = rewriteFileLinks({
        content: 'Do not ship unless canonical `.agentsmesh/...` references round-trip cleanly.',
        projectRoot,
        sourceFile,
        destinationFile,
        translatePath: identityTranslate,
        pathExists: meshRootExists,
        rewriteBarePathTokens: true,
      });

      expect(result.content).toBe(
        'Do not ship unless canonical `.agentsmesh/...` references round-trip cleanly.',
      );
    });

    it('preserves .agentsmesh/ contract reference in mixed prose', () => {
      const result = rewriteFileLinks({
        content:
          'Preserve the canonical `.agentsmesh/` contract. Config lives in `.agentsmesh/` always.',
        projectRoot,
        sourceFile,
        destinationFile,
        translatePath: identityTranslate,
        pathExists: meshRootExists,
        rewriteBarePathTokens: true,
      });

      expect(result.content).toBe(
        'Preserve the canonical `.agentsmesh/` contract. Config lives in `.agentsmesh/` always.',
      );
    });

    it('preserves .agentsmesh skill directory prose instead of retargeting it to generated tool roots', () => {
      const result = rewriteFileLinks({
        content: 'Use `.agentsmesh/skills/qa/` for shared QA routines.',
        projectRoot,
        sourceFile: '/proj/.agentsmesh/rules/_root.md',
        destinationFile: '/proj/CLAUDE.md',
        translatePath: (p) => (p === '/proj/.agentsmesh/skills/qa' ? '/proj/.claude/skills/qa' : p),
        pathExists: (p) => p === '/proj/.claude/skills/qa',
        pathIsDirectory: (p) => p === '/proj/.claude/skills/qa',
        rewriteBarePathTokens: true,
      });

      expect(result.content).toBe('Use `.agentsmesh/skills/qa/` for shared QA routines.');
    });

    it('preserves .agentsmesh file prose instead of using destination-relative output', () => {
      const result = rewriteFileLinks({
        content: 'Load `.agentsmesh/skills/api-gen/SKILL.md`.',
        projectRoot,
        sourceFile,
        destinationFile,
        translatePath: (p) =>
          p === '/proj/.agentsmesh/skills/api-gen/SKILL.md'
            ? '/proj/.claude/skills/api-gen/SKILL.md'
            : p,
        pathExists: (p) => p === '/proj/.claude/skills/api-gen/SKILL.md',
      });

      expect(result.content).toBe('Load `.agentsmesh/skills/api-gen/SKILL.md`.');
    });
  });

  describe('markdown link destinations — destination-relative form still applies', () => {
    it('keeps ./references/ for markdown link pointing at sibling directory', () => {
      const result = rewriteFileLinks({
        content: 'See [references](.agentsmesh/skills/add-agent-target/references/).',
        projectRoot,
        sourceFile,
        destinationFile,
        translatePath: (p) =>
          p === '/proj/.agentsmesh/skills/add-agent-target/references'
            ? '/proj/.claude/skills/add-agent-target/references'
            : p,
        pathExists: (p) => p === '/proj/.claude/skills/add-agent-target/references',
        explicitCurrentDirLinks: true,
        rewriteBarePathTokens: true,
        pathIsDirectory: (p) => p === '/proj/.claude/skills/add-agent-target/references',
      });

      expect(result.content).toBe('See [references](./references/).');
    });

    it('uses ../ paths for markdown links from a generated skill to a generated rule', () => {
      const result = rewriteFileLinks({
        content: 'Read [rule](../../rules/typescript.md).',
        projectRoot,
        sourceFile,
        destinationFile,
        translatePath: (p) =>
          p === '/proj/.agentsmesh/rules/typescript.md' ? '/proj/.claude/rules/typescript.md' : p,
        pathExists: (p) => p === '/proj/.claude/rules/typescript.md',
        explicitCurrentDirLinks: true,
      });

      expect(result.content).toBe('Read [rule](../../rules/typescript.md).');
    });
  });

  describe('project-root prose references (I2)', () => {
    it('uses repo-root style for deep generated inline-code project paths', () => {
      const result = rewriteFileLinks({
        content: 'Importer lives at `../../../../src/cli/commands/import.ts`.',
        projectRoot,
        sourceFile: '/proj/.agentsmesh/skills/add-agent-target/references/checklist.md',
        destinationFile: '/proj/.claude/skills/add-agent-target/references/checklist.md',
        translatePath: identityTranslate,
        pathExists: (p) => p === '/proj/src/cli/commands/import.ts',
      });

      expect(result.content).toBe('Importer lives at `src/cli/commands/import.ts`.');
    });

    it('uses repo-root style for deep generated inline-code test paths', () => {
      const result = rewriteFileLinks({
        content: 'Watch coverage uses `../../../tests/unit/cli/commands/watch.test.ts`.',
        projectRoot,
        sourceFile: '/proj/.agentsmesh/skills/prepare-release/SKILL.md',
        destinationFile: '/proj/.claude/skills/prepare-release/SKILL.md',
        translatePath: identityTranslate,
        pathExists: (p) => p === '/proj/tests/unit/cli/commands/watch.test.ts',
      });

      expect(result.content).toBe('Watch coverage uses `tests/unit/cli/commands/watch.test.ts`.');
    });
  });
});
