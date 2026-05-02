import { describe, expect, it } from 'vitest';
import {
  resolveLinkTarget,
  type ResolveLinkTargetInput,
} from '../../../src/core/reference/link-rebaser-resolution.js';

const PROJECT_ROOT = '/proj';

function makeInput(overrides: Partial<ResolveLinkTargetInput>): ResolveLinkTargetInput {
  return {
    candidate: '',
    rawToken: '',
    projectRoot: PROJECT_ROOT,
    sourceFile: '/proj/.agentsmesh/rules/_root.md',
    destinationFile: '/proj/.claude/CLAUDE.md',
    translatePath: (p) => p,
    pathExists: () => false,
    ...overrides,
  };
}

describe('resolveLinkTarget', () => {
  it('matches a relative `./…` token via translatePath when the translated path exists', () => {
    const before = '/proj/.agentsmesh/skills/x/foo.md';
    const after = '/proj/.claude/skills/x/foo.md';
    const result = resolveLinkTarget(
      makeInput({
        candidate: './foo.md',
        rawToken: './foo.md',
        sourceFile: '/proj/.agentsmesh/skills/x/SKILL.md',
        translatePath: (p) => (p === before ? after : p),
        pathExists: (p) => p === after,
      }),
    );

    expect(result.matchedPath).toBe(true);
    expect(result.translatedPath).toBe(after);
    expect(result.resolvedBeforeTranslate).toBe(before);
  });

  it('resolves a registered root-relative `.claude/…` token via the savedFallback branch', () => {
    // Two segments → suffix-strip skips, so the savedFallback path wins and
    // populates resolvedBeforeTranslate (suffix-strip would leave it null).
    const matched = '/proj/.claude/notes.md';
    const result = resolveLinkTarget(
      makeInput({
        candidate: '.claude/notes.md',
        rawToken: '.claude/notes.md',
        sourceFile: '/proj/.claude/CLAUDE.md',
        pathExists: (p) => p === matched,
      }),
    );

    expect(result.matchedPath).toBe(true);
    expect(result.translatedPath).toBe(matched);
    expect(result.resolvedBeforeTranslate).toBe(matched);
  });

  it('resolves a canonical `.agentsmesh/…` token under the project root with identity translation', () => {
    const matched = '/proj/.agentsmesh/agents/reviewer.md';
    const result = resolveLinkTarget(
      makeInput({
        candidate: '.agentsmesh/agents/reviewer.md',
        rawToken: '.agentsmesh/agents/reviewer.md',
        sourceFile: '/proj/.agentsmesh/skills/x/SKILL.md',
        pathExists: (p) => p === matched,
      }),
    );

    expect(result.matchedPath).toBe(true);
    expect(result.translatedPath).toBe(matched);
    expect(result.resolvedBeforeTranslate).toBe(matched);
  });

  it('falls back to suffix-strip below the destination directory when direct resolution misses', () => {
    // Candidate points into `.codex/...` which does not exist; suffix-strip walks
    // tail segments under destDir until it finds an existing path.
    const candidate = '.codex/skills/figma/references/checklist.md';
    const stripped = '/proj/.claude/skills/x/figma/references/checklist.md';
    const result = resolveLinkTarget(
      makeInput({
        candidate,
        rawToken: candidate,
        sourceFile: '/proj/.agentsmesh/skills/x/SKILL.md',
        destinationFile: '/proj/.claude/skills/x/SKILL.md',
        pathExists: (p) => p === stripped,
      }),
    );

    expect(result.matchedPath).toBe(true);
    expect(result.translatedPath).toBe(stripped);
    // Suffix-strip wins before savedFallback can run, so resolvedBeforeTranslate stays null.
    expect(result.resolvedBeforeTranslate).toBeNull();
  });

  it('returns matchedPath=false when nothing exists and no canonical-mesh fallback applies', () => {
    const result = resolveLinkTarget(
      makeInput({
        candidate: './missing.md',
        rawToken: './missing.md',
        pathExists: () => false,
      }),
    );

    expect(result.matchedPath).toBe(false);
  });

  it('translates a canonical token to its target path and preserves resolvedBeforeTranslate', () => {
    const before = '/proj/.agentsmesh/agents/reviewer.md';
    const after = '/proj/.claude/agents/reviewer.md';
    const result = resolveLinkTarget(
      makeInput({
        candidate: '.agentsmesh/agents/reviewer.md',
        rawToken: '.agentsmesh/agents/reviewer.md',
        sourceFile: '/proj/.claude/CLAUDE.md',
        translatePath: (p) => (p === before ? after : p),
        pathExists: (p) => p === after,
      }),
    );

    expect(result.matchedPath).toBe(true);
    expect(result.translatedPath).toBe(after);
    expect(result.resolvedBeforeTranslate).toBe(before);
  });

  it('treats a canonical-mesh rawToken as matched when the destination is also under `.agentsmesh/`', () => {
    // Final mesh-canonical fallback: rawToken starts with `.agentsmesh/` AND
    // destinationFile lives in canonical mesh — used for inter-mesh references
    // that the link rebaser later normalizes via the canonical-anchor branch.
    const result = resolveLinkTarget(
      makeInput({
        candidate: '.agentsmesh/rules/typescript.md',
        rawToken: '.agentsmesh/rules/typescript.md',
        sourceFile: '/proj/.agentsmesh/rules/_root.md',
        destinationFile: '/proj/.agentsmesh/rules/_root.md',
        pathExists: () => false,
      }),
    );

    expect(result.matchedPath).toBe(true);
    expect(result.translatedPath).toBe('/proj/.agentsmesh/rules/typescript.md');
  });

  it('does not apply the canonical-mesh fallback when the destination is outside `.agentsmesh/`', () => {
    // Negative twin of the previous case: same canonical-mesh rawToken but the
    // destination lives in a tool surface (`.claude/`), so the fallback gate
    // is closed and matchedPath stays false when no path exists.
    const result = resolveLinkTarget(
      makeInput({
        candidate: '.agentsmesh/rules/typescript.md',
        rawToken: '.agentsmesh/rules/typescript.md',
        sourceFile: '/proj/.claude/CLAUDE.md',
        destinationFile: '/proj/.claude/CLAUDE.md',
        pathExists: () => false,
      }),
    );

    expect(result.matchedPath).toBe(false);
  });
});
