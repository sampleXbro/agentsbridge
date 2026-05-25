/**
 * Branch coverage for src/targets/amp/mcp-import.ts:
 * - missing file → return (line 24).
 * - invalid JSON catch (line 30).
 * - parsed is array/null/primitive (line 32).
 * - settings['amp.mcpServers'] vs ['mcpServers'] fallback (line 35).
 * - rawServers null/undefined/non-object/array/empty (lines 36-37).
 * - non-object server entries skipped (line 41).
 * - empty mcpServers after filter → no result (line 45).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importAmpMcp } from '../../../../src/targets/amp/mcp-import.js';
import type { ImportResult } from '../../../../src/core/types.js';

let projectRoot = '';

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'am-amp-mcp-'));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('importAmpMcp — branch coverage', () => {
  it('returns silently when settings file is missing', async () => {
    const results: ImportResult[] = [];
    await importAmpMcp(projectRoot, '.amp/settings.json', results);
    expect(results).toEqual([]);
  });

  it('returns silently when settings file is invalid JSON', async () => {
    mkdirSync(join(projectRoot, '.amp'), { recursive: true });
    writeFileSync(join(projectRoot, '.amp', 'settings.json'), '{ not valid');
    const results: ImportResult[] = [];
    await importAmpMcp(projectRoot, '.amp/settings.json', results);
    expect(results).toEqual([]);
  });

  it('returns silently when parsed is an array', async () => {
    mkdirSync(join(projectRoot, '.amp'), { recursive: true });
    writeFileSync(join(projectRoot, '.amp', 'settings.json'), '[]');
    const results: ImportResult[] = [];
    await importAmpMcp(projectRoot, '.amp/settings.json', results);
    expect(results).toEqual([]);
  });

  it('falls back from amp.mcpServers to mcpServers when missing', async () => {
    mkdirSync(join(projectRoot, '.amp'), { recursive: true });
    writeFileSync(
      join(projectRoot, '.amp', 'settings.json'),
      JSON.stringify({ mcpServers: { srv: { command: 'node' } } }),
    );
    const results: ImportResult[] = [];
    await importAmpMcp(projectRoot, '.amp/settings.json', results);
    expect(results).toHaveLength(1);
  });

  it('prefers amp.mcpServers over mcpServers when both present', async () => {
    mkdirSync(join(projectRoot, '.amp'), { recursive: true });
    writeFileSync(
      join(projectRoot, '.amp', 'settings.json'),
      JSON.stringify({
        'amp.mcpServers': { primary: { command: 'a' } },
        mcpServers: { other: { command: 'b' } },
      }),
    );
    const results: ImportResult[] = [];
    await importAmpMcp(projectRoot, '.amp/settings.json', results);
    expect(results).toHaveLength(1);
  });

  it('returns silently when rawServers is an empty object', async () => {
    mkdirSync(join(projectRoot, '.amp'), { recursive: true });
    writeFileSync(
      join(projectRoot, '.amp', 'settings.json'),
      JSON.stringify({ 'amp.mcpServers': {} }),
    );
    const results: ImportResult[] = [];
    await importAmpMcp(projectRoot, '.amp/settings.json', results);
    expect(results).toEqual([]);
  });

  it('returns silently when rawServers is an array', async () => {
    mkdirSync(join(projectRoot, '.amp'), { recursive: true });
    writeFileSync(
      join(projectRoot, '.amp', 'settings.json'),
      JSON.stringify({ 'amp.mcpServers': [] }),
    );
    const results: ImportResult[] = [];
    await importAmpMcp(projectRoot, '.amp/settings.json', results);
    expect(results).toEqual([]);
  });

  it('skips non-object server values; returns silent when all filtered out', async () => {
    mkdirSync(join(projectRoot, '.amp'), { recursive: true });
    writeFileSync(
      join(projectRoot, '.amp', 'settings.json'),
      JSON.stringify({ 'amp.mcpServers': { junk: 'string', arr: [], nil: null } }),
    );
    const results: ImportResult[] = [];
    await importAmpMcp(projectRoot, '.amp/settings.json', results);
    expect(results).toEqual([]);
  });
});
