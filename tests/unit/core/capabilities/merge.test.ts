import { describe, expect, it } from 'vitest';
import { mergeCell, hasNonEmptyFingerprint } from '../../../../src/core/capabilities/merge.js';
import type { LedgerCell } from '../../../../src/core/capabilities/ledger-types.js';

function makeCell(over: Partial<LedgerCell> = {}): LedgerCell {
  return {
    target: 'cursor',
    feature: 'mcp',
    scope: 'project',
    maxAchievable: 'native',
    path: '.cursor/mcp.json',
    ext: '.json',
    format: 'json',
    fingerprint: { topLevelKeys: [], requiredFrontmatter: [], keyChecks: [] },
    source: [],
    verifiedAt: null,
    verdict: 'unverified',
    rejectionReason: null,
    ...over,
  };
}

describe('hasNonEmptyFingerprint', () => {
  it('returns false when all fingerprint arrays are empty', () => {
    const fp = { topLevelKeys: [], requiredFrontmatter: [], keyChecks: [] };
    expect(hasNonEmptyFingerprint(fp)).toBe(false);
  });

  it('returns true when only topLevelKeys is non-empty', () => {
    const fp = { topLevelKeys: ['mcpServers'], requiredFrontmatter: [], keyChecks: [] };
    expect(hasNonEmptyFingerprint(fp)).toBe(true);
  });

  it('returns true when only requiredFrontmatter is non-empty', () => {
    const fp = { topLevelKeys: [], requiredFrontmatter: ['name'], keyChecks: [] };
    expect(hasNonEmptyFingerprint(fp)).toBe(true);
  });

  it('returns true when only keyChecks is non-empty', () => {
    const fp = {
      topLevelKeys: [],
      requiredFrontmatter: [],
      keyChecks: [{ pointer: '/name', kind: 'string' as const }],
    };
    expect(hasNonEmptyFingerprint(fp)).toBe(true);
  });
});

describe('mergeCell', () => {
  const newCell = makeCell({ maxAchievable: 'embedded', verdict: 'unverified', verifiedAt: null });

  it('preserves confirmed maxAchievable ceiling even when descriptor is lower', () => {
    const existing = makeCell({
      maxAchievable: 'native',
      verdict: 'confirmed',
      verifiedAt: '2026-01-01',
    });
    const merged = mergeCell(existing, newCell);
    expect(merged.maxAchievable).toBe('native');
  });

  it('preserves rejected maxAchievable ceiling even when descriptor is lower', () => {
    const existing = makeCell({
      maxAchievable: 'native',
      verdict: 'rejected',
      verifiedAt: '2026-01-01',
    });
    const merged = mergeCell(existing, newCell);
    expect(merged.maxAchievable).toBe('native');
  });

  it('takes the higher level for unverified cells when new is higher', () => {
    const existing = makeCell({
      maxAchievable: 'partial',
      verdict: 'unverified',
      verifiedAt: null,
    });
    const higherNew = makeCell({
      maxAchievable: 'native',
      verdict: 'unverified',
      verifiedAt: null,
    });
    const merged = mergeCell(existing, higherNew);
    expect(merged.maxAchievable).toBe('native');
  });

  it('takes the higher level for unverified cells when existing is higher', () => {
    const existing = makeCell({ maxAchievable: 'native', verdict: 'unverified', verifiedAt: null });
    const merged = mergeCell(existing, newCell); // newCell is 'embedded'
    expect(merged.maxAchievable).toBe('native');
  });

  it('preserves fingerprint when only requiredFrontmatter is non-empty (topLevelKeys empty)', () => {
    const existing = makeCell({
      fingerprint: { topLevelKeys: [], requiredFrontmatter: ['name'], keyChecks: [] },
    });
    const newBlankCell = makeCell({
      fingerprint: { topLevelKeys: [], requiredFrontmatter: [], keyChecks: [] },
    });
    const merged = mergeCell(existing, newBlankCell);
    expect(merged.fingerprint.requiredFrontmatter).toEqual(['name']);
    expect(merged.fingerprint.topLevelKeys).toEqual([]);
  });

  it('preserves fingerprint when only keyChecks is non-empty (topLevelKeys empty)', () => {
    const kc = { pointer: '/name', kind: 'string' as const };
    const existing = makeCell({
      fingerprint: { topLevelKeys: [], requiredFrontmatter: [], keyChecks: [kc] },
    });
    const newBlankCell = makeCell({
      fingerprint: { topLevelKeys: [], requiredFrontmatter: [], keyChecks: [] },
    });
    const merged = mergeCell(existing, newBlankCell);
    expect(merged.fingerprint.keyChecks).toEqual([kc]);
  });

  it('uses new cell fingerprint when existing fingerprint is fully empty', () => {
    const newWithFp = makeCell({
      fingerprint: { topLevelKeys: ['mcpServers'], requiredFrontmatter: [], keyChecks: [] },
    });
    const emptyExisting = makeCell({
      fingerprint: { topLevelKeys: [], requiredFrontmatter: [], keyChecks: [] },
    });
    const merged = mergeCell(emptyExisting, newWithFp);
    expect(merged.fingerprint.topLevelKeys).toEqual(['mcpServers']);
  });

  it('prefers existing path when new cell has no path', () => {
    const existing = makeCell({ path: '.cursor/mcp.json', ext: '.json' });
    const noPath = makeCell({ path: '', ext: '' });
    const merged = mergeCell(existing, noPath);
    expect(merged.path).toBe('.cursor/mcp.json');
  });

  it('uses new cell path when it is non-empty', () => {
    const existing = makeCell({ path: '.cursor/mcp.json', ext: '.json' });
    const newPath = makeCell({ path: '.cursor/settings.json', ext: '.json' });
    const merged = mergeCell(existing, newPath);
    expect(merged.path).toBe('.cursor/settings.json');
  });

  it('preserves provenance fields from existing cell', () => {
    const existing = makeCell({
      source: ['https://docs.example.com'],
      verifiedAt: '2026-01-01',
      verdict: 'confirmed',
      rejectionReason: null,
    });
    const merged = mergeCell(existing, newCell);
    expect(merged.source).toEqual(['https://docs.example.com']);
    expect(merged.verifiedAt).toBe('2026-01-01');
    expect(merged.verdict).toBe('confirmed');
  });

  it('output cell has same target/feature/scope as new cell (descriptor-authoritative)', () => {
    const existing = makeCell({ target: 'cursor', feature: 'mcp', scope: 'project' });
    const merged = mergeCell(existing, newCell);
    expect(merged.target).toBe('cursor');
    expect(merged.feature).toBe('mcp');
    expect(merged.scope).toBe('project');
  });
});

describe('empty fingerprint conformance documentation', () => {
  it('documents that an empty fingerprint means only extension+path are checked (no structural check)', () => {
    // This test documents the behaviour contract: when all three fingerprint
    // arrays are empty, checkConformance only verifies the file extension.
    // Structural correctness (keys, frontmatter, keyChecks) is NOT validated.
    // Callers who need structural validation MUST populate at least one array.
    const emptyFp = { topLevelKeys: [], requiredFrontmatter: [], keyChecks: [] };
    expect(hasNonEmptyFingerprint(emptyFp)).toBe(false);
    // A false result from hasNonEmptyFingerprint signals "extension-only" conformance.
  });
});
