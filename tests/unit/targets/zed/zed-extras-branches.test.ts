/**
 * Branch coverage for zed lintIgnore and mcp-import guard branches.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as zedLint from '../../../../src/targets/zed/lint.js';
import { importZedMcp } from '../../../../src/targets/zed/mcp-import.js';
import type { CanonicalFiles, ImportResult } from '../../../../src/core/types.js';

function emptyCanonical(): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

describe('zed lintIgnore', () => {
  it('returns [] when ignore array is empty', () => {
    expect(zedLint.lintIgnore(emptyCanonical())).toEqual([]);
  });

  it('returns [] when every pattern maps to a Zed glob', () => {
    expect(zedLint.lintIgnore({ ...emptyCanonical(), ignore: ['node_modules/'] })).toEqual([]);
  });

  it('warns and names the re-inclusions Zed glob lists cannot express', () => {
    const diags = zedLint.lintIgnore({
      ...emptyCanonical(),
      ignore: ['dist/', '!dist/keep.txt'],
    });
    expect(diags).toHaveLength(1);
    expect(diags[0]!.message).toContain('!dist/keep.txt');
  });
});

describe('zed importZedMcp — malformed-input branch gaps', () => {
  let root: string;
  let results: ImportResult[];

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'zed-mcp-'));
    results = [];
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('returns early when settings.json does not exist', async () => {
    await importZedMcp(root, '.zed/settings.json', results);
    expect(results).toEqual([]);
  });

  it('returns early on malformed JSON without throwing', async () => {
    mkdirSync(join(root, '.zed'), { recursive: true });
    writeFileSync(join(root, '.zed/settings.json'), '{ not valid');
    await importZedMcp(root, '.zed/settings.json', results);
    expect(results).toEqual([]);
  });

  it('returns early when JSON root is an array', async () => {
    mkdirSync(join(root, '.zed'), { recursive: true });
    writeFileSync(join(root, '.zed/settings.json'), '[]');
    await importZedMcp(root, '.zed/settings.json', results);
    expect(results).toEqual([]);
  });

  it('returns early when context_servers is missing', async () => {
    mkdirSync(join(root, '.zed'), { recursive: true });
    writeFileSync(join(root, '.zed/settings.json'), '{}');
    await importZedMcp(root, '.zed/settings.json', results);
    expect(results).toEqual([]);
  });

  it('returns early when context_servers is empty', async () => {
    mkdirSync(join(root, '.zed'), { recursive: true });
    writeFileSync(join(root, '.zed/settings.json'), '{"context_servers": {}}');
    await importZedMcp(root, '.zed/settings.json', results);
    expect(results).toEqual([]);
  });

  it('skips non-object server entries but still imports valid ones', async () => {
    mkdirSync(join(root, '.zed'), { recursive: true });
    writeFileSync(
      join(root, '.zed/settings.json'),
      JSON.stringify({
        context_servers: {
          bogus: 'not-an-object',
          arr: [],
          good: { command: 'x', args: [] },
        },
      }),
    );
    await importZedMcp(root, '.zed/settings.json', results);
    expect(results).toHaveLength(1);
    expect(results[0].feature).toBe('mcp');
    expect(existsSync(join(root, '.agentsmesh/mcp.json'))).toBe(true);
  });
});
