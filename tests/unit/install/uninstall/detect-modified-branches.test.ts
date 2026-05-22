/**
 * Branch coverage for src/install/uninstall/detect-modified.ts lines 77-78:
 * the race-deletion branch where readDirRecursive surfaced the file but
 * hashFile returns null (ENOENT). A broken symlink makes that branch
 * deterministic on POSIX platforms.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectModifiedFiles } from '../../../../src/install/uninstall/detect-modified.js';

let packDir: string;

beforeEach(() => {
  packDir = mkdtempSync(join(tmpdir(), 'am-detect-modified-edge-'));
});

afterEach(() => {
  rmSync(packDir, { recursive: true, force: true });
});

describe('detectModifiedFiles — race-deletion branch', () => {
  it('folds a present-but-unreadable file (broken symlink) into deleted status', async () => {
    try {
      symlinkSync(join(packDir, 'no-target'), join(packDir, 'dangling.md'));
    } catch {
      // Symlinks unavailable on this platform — skip.
      return;
    }
    const manifestFiles: Record<string, string> = {
      'dangling.md': 'sha256:deadbeef',
    };

    const drift = await detectModifiedFiles(packDir, manifestFiles);

    expect(drift).toEqual([{ relativePath: 'dangling.md', status: 'deleted' }]);
  });

  it('sorts drift entries ascending by relativePath when both deleted and added are present', async () => {
    // A file recorded in manifest but missing → deleted.
    // A file on disk but absent from manifest → added.
    writeFileSync(join(packDir, 'b-added.md'), 'b');

    const manifestFiles: Record<string, string> = {
      'a-deleted.md': 'sha256:deadbeef',
    };

    const drift = await detectModifiedFiles(packDir, manifestFiles);

    expect(drift).toEqual([
      { relativePath: 'a-deleted.md', status: 'deleted' },
      { relativePath: 'b-added.md', status: 'added' },
    ]);
  });
});
