/**
 * Auto-discovered builtin catalog drift guard.
 *
 * Ensures the generated catalog files stay in sync with the filesystem layout
 * under `src/targets/`. Adding a new target directory should require only
 * (a) creating the directory with `index.ts` exporting `descriptor`, and
 * (b) running `pnpm verify:catalog` (or `pnpm build`, which triggers codegen
 * via `prebuild`).
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILTIN_TARGET_IDS } from '../../../../src/targets/catalog/builtin-target-ids-generated.js';
import { TARGET_IDS } from '../../../../src/targets/catalog/target-ids.js';
import { BUILTIN_TARGETS } from '../../../../src/targets/catalog/builtin-targets.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const TARGETS_DIR = join(REPO_ROOT, 'src', 'targets');
const NON_TARGET_DIRS = new Set(['catalog', 'import', 'projection']);

function discoverTargetDirs(): string[] {
  return readdirSync(TARGETS_DIR)
    .filter((entry) => {
      const full = join(TARGETS_DIR, entry);
      return (
        statSync(full).isDirectory() &&
        !NON_TARGET_DIRS.has(entry) &&
        existsSync(join(full, 'index.ts'))
      );
    })
    .sort();
}

describe('builtin target catalog (auto-discovered)', () => {
  it('every target directory under src/targets/ is registered', () => {
    expect([...BUILTIN_TARGET_IDS]).toEqual(discoverTargetDirs());
  });

  it('every target directory exports a `descriptor` const from index.ts', () => {
    for (const dir of discoverTargetDirs()) {
      const indexPath = join(TARGETS_DIR, dir, 'index.ts');
      const source = readFileSync(indexPath, 'utf-8');
      expect(
        /export\s+const\s+descriptor\b/.test(source),
        `${dir}/index.ts must export const descriptor`,
      ).toBe(true);
    }
  });

  it('directory name matches descriptor.id for every entry', () => {
    expect(BUILTIN_TARGETS.map((d) => d.id)).toEqual([...BUILTIN_TARGET_IDS]);
  });

  it('TARGET_IDS public re-export contains the same IDs as the generated catalog', () => {
    expect([...TARGET_IDS].sort()).toEqual([...BUILTIN_TARGET_IDS].sort());
  });

  it('BUILTIN_TARGETS array length matches generated id list', () => {
    expect(BUILTIN_TARGETS).toHaveLength(BUILTIN_TARGET_IDS.length);
  });

  it('generated id list is alphabetically sorted', () => {
    expect([...BUILTIN_TARGET_IDS]).toEqual([...BUILTIN_TARGET_IDS].sort());
  });
});
