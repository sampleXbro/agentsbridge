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
  });
});
