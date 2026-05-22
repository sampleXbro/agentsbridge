/**
 * Branch coverage for src/targets/augment-code/settings-helpers.ts:
 * - JSON.parse catch (line 74).
 * - missing file → no-op.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importAugmentSettings } from '../../../../src/targets/augment-code/settings-helpers.js';
import type { ImportResult } from '../../../../src/core/types.js';

let projectRoot = '';

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'am-augment-sett-'));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('importAugmentSettings — branch coverage', () => {
  it('returns silently when settings.json file is missing', async () => {
    const results: ImportResult[] = [];
    await importAugmentSettings(projectRoot, '.augment/settings.json', results);
    expect(results).toEqual([]);
  });

  it('returns silently when settings.json is invalid JSON (catch branch)', async () => {
    mkdirSync(join(projectRoot, '.augment'), { recursive: true });
    writeFileSync(join(projectRoot, '.augment', 'settings.json'), '{ broken');
    const results: ImportResult[] = [];
    await importAugmentSettings(projectRoot, '.augment/settings.json', results);
    expect(results).toEqual([]);
  });

  it('imports mcpServers object when present', async () => {
    mkdirSync(join(projectRoot, '.augment'), { recursive: true });
    writeFileSync(
      join(projectRoot, '.augment', 'settings.json'),
      JSON.stringify({ mcpServers: { srv: { command: 'node', args: [], env: {} } } }),
    );
    const results: ImportResult[] = [];
    await importAugmentSettings(projectRoot, '.augment/settings.json', results);
    expect(results.find((r) => r.feature === 'mcp')).toBeDefined();
  });

  it('skips mcpServers when it is null', async () => {
    mkdirSync(join(projectRoot, '.augment'), { recursive: true });
    writeFileSync(
      join(projectRoot, '.augment', 'settings.json'),
      JSON.stringify({ mcpServers: null }),
    );
    const results: ImportResult[] = [];
    await importAugmentSettings(projectRoot, '.augment/settings.json', results);
    expect(results.find((r) => r.feature === 'mcp')).toBeUndefined();
  });
});
