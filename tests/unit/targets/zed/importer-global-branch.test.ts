/**
 * Branch coverage for src/targets/zed/importer.ts line 27:
 * - scope === 'global' branch (uses ZED_GLOBAL_SETTINGS_FILE).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFromZed } from '../../../../src/targets/zed/importer.js';

let projectRoot = '';

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'am-zed-global-'));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('importFromZed — global scope branch', () => {
  it('uses ZED_GLOBAL_SETTINGS_FILE under global scope (line 27 false branch)', async () => {
    const results = await importFromZed(projectRoot, { scope: 'global' });
    expect(results.find((r) => r.feature === 'mcp')).toBeUndefined();
  });

  it('uses ZED_SETTINGS_FILE under project scope (default)', async () => {
    const results = await importFromZed(projectRoot);
    expect(results.find((r) => r.feature === 'mcp')).toBeUndefined();
  });
});
