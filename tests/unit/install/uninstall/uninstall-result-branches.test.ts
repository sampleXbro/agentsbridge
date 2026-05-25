/**
 * Branch coverage for `previewEntries`, `appliedEntry`, and `buildSkipped`
 * in `src/install/uninstall/uninstall-result.ts`. Covers:
 *   - buildSkipped: maps names with the canonical "not found" reason
 *   - previewEntries: null pack_path when manifestEntry is null (extends-only)
 *   - previewEntries: forward-slash pack_path when manifestEntry exists
 *   - appliedEntry: action === 'keep-modified' → preserves modified_files_kept
 *   - appliedEntry: packDirRemoved=true + action='delete-anyway' → empties modified_files_kept
 */
import { describe, it, expect } from 'vitest';
import {
  appliedEntry,
  buildSkipped,
  previewEntries,
} from '../../../../src/install/uninstall/uninstall-result.js';
import type { RemovalDecision } from '../../../../src/install/uninstall/uninstall-decisions.js';

const decision = (overrides: Partial<RemovalDecision> = {}): RemovalDecision =>
  ({
    plan: {
      name: 'pack',
      manifestEntry: { name: 'pack', source: 'github:o/r', version: 'abc', features: [] },
    },
    modifications: [{ relativePath: 'sub/x.md', status: 'modified' }],
    action: 'delete-anyway',
    legacyMigrated: false,
    packDirMissing: false,
    ...overrides,
  }) as unknown as RemovalDecision;

describe('buildSkipped', () => {
  it('maps each name to a uniform "not found in installs.yaml" entry', () => {
    expect(buildSkipped(['a', 'b'])).toEqual([
      { name: 'a', reason: 'not found in installs.yaml' },
      { name: 'b', reason: 'not found in installs.yaml' },
    ]);
  });

  it('returns [] for an empty input', () => {
    expect(buildSkipped([])).toEqual([]);
  });
});

describe('previewEntries', () => {
  it('returns null pack_path when manifestEntry is null (extends-only install)', () => {
    const out = previewEntries(
      [decision({ plan: { name: 'p', manifestEntry: null } as RemovalDecision['plan'] })],
      '/root',
      '/root/.agentsmesh/packs',
    );
    expect(out[0]!.pack_path).toBeNull();
    expect(out[0]!.manifest_entry_removed).toBe(false);
    expect(out[0]!.extends_entry_removed).toBe(false);
    expect(out[0]!.generated_files_removed).toBe(0);
  });

  it('produces a forward-slash pack_path relative to rootBase when manifest entry exists', () => {
    const out = previewEntries([decision()], '/root', '/root/.agentsmesh/packs');
    expect(out[0]!.pack_path).toBe('.agentsmesh/packs/pack');
    expect(out[0]!.modified_files_kept).toEqual([{ relativePath: 'sub/x.md', status: 'modified' }]);
  });
});

describe('appliedEntry', () => {
  const applied = {
    name: 'pack',
    manifestEntryRemoved: true,
    extendsEntryRemoved: true,
    packDirRemoved: true,
    partial: false,
  };

  it('keeps modified_files_kept when the user chose [k]eep-modified at the prompt', () => {
    const out = appliedEntry(
      decision({ action: 'keep-modified' }),
      applied,
      '/root',
      '/root/.agentsmesh/packs',
    );
    expect(out.modified_files_kept).toEqual([{ relativePath: 'sub/x.md', status: 'modified' }]);
  });

  it('empties modified_files_kept when packDirRemoved=true and action !== "keep-modified"', () => {
    const out = appliedEntry(decision(), applied, '/root', '/root/.agentsmesh/packs');
    expect(out.modified_files_kept).toEqual([]);
    expect(out.manifest_entry_removed).toBe(true);
  });

  it('keeps modifications visible when packDirRemoved=false even with action="delete-anyway"', () => {
    const out = appliedEntry(
      decision(),
      { ...applied, packDirRemoved: false },
      '/root',
      '/root/.agentsmesh/packs',
    );
    expect(out.modified_files_kept).toEqual([{ relativePath: 'sub/x.md', status: 'modified' }]);
  });
});
