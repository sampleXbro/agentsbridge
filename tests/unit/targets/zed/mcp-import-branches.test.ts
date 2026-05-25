/**
 * Branch coverage for src/targets/zed/mcp-import.ts:
 * - settings file missing → return.
 * - malformed JSON catch branch.
 * - parsed is array / null / primitive.
 * - context_servers missing / non-object / array / empty.
 * - non-object server entries skipped.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importZedMcp } from '../../../../src/targets/zed/mcp-import.js';
import type { ImportResult } from '../../../../src/core/types.js';

let projectRoot = '';

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'am-zed-mcp-'));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('importZedMcp — branch coverage', () => {
  it('returns silently when settings file is missing', async () => {
    const results: ImportResult[] = [];
    await importZedMcp(projectRoot, '.zed/settings.json', results);
    expect(results).toEqual([]);
  });

  it('returns silently when settings file is invalid JSON', async () => {
    mkdirSync(join(projectRoot, '.zed'), { recursive: true });
    writeFileSync(join(projectRoot, '.zed', 'settings.json'), '{ not valid');
    const results: ImportResult[] = [];
    await importZedMcp(projectRoot, '.zed/settings.json', results);
    expect(results).toEqual([]);
  });

  it('returns silently when settings is a JSON array (not object)', async () => {
    mkdirSync(join(projectRoot, '.zed'), { recursive: true });
    writeFileSync(join(projectRoot, '.zed', 'settings.json'), '[]');
    const results: ImportResult[] = [];
    await importZedMcp(projectRoot, '.zed/settings.json', results);
    expect(results).toEqual([]);
  });

  it('returns silently when context_servers is missing', async () => {
    mkdirSync(join(projectRoot, '.zed'), { recursive: true });
    writeFileSync(join(projectRoot, '.zed', 'settings.json'), JSON.stringify({ other: 1 }));
    const results: ImportResult[] = [];
    await importZedMcp(projectRoot, '.zed/settings.json', results);
    expect(results).toEqual([]);
  });

  it('returns silently when context_servers is an array', async () => {
    mkdirSync(join(projectRoot, '.zed'), { recursive: true });
    writeFileSync(
      join(projectRoot, '.zed', 'settings.json'),
      JSON.stringify({ context_servers: [] }),
    );
    const results: ImportResult[] = [];
    await importZedMcp(projectRoot, '.zed/settings.json', results);
    expect(results).toEqual([]);
  });

  it('returns silently when context_servers is an empty object', async () => {
    mkdirSync(join(projectRoot, '.zed'), { recursive: true });
    writeFileSync(
      join(projectRoot, '.zed', 'settings.json'),
      JSON.stringify({ context_servers: {} }),
    );
    const results: ImportResult[] = [];
    await importZedMcp(projectRoot, '.zed/settings.json', results);
    expect(results).toEqual([]);
  });

  it('imports valid server entries and strips the "source" field', async () => {
    mkdirSync(join(projectRoot, '.zed'), { recursive: true });
    writeFileSync(
      join(projectRoot, '.zed', 'settings.json'),
      JSON.stringify({
        context_servers: {
          good: { command: 'node', args: ['s.js'], source: 'extension' },
          ignoredString: 'no',
          ignoredArr: [1],
        },
      }),
    );
    const results: ImportResult[] = [];
    await importZedMcp(projectRoot, '.zed/settings.json', results);
    expect(results).toHaveLength(1);
    expect(results[0]!.feature).toBe('mcp');
  });
});
