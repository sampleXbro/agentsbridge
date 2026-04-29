/**
 * Branch coverage tests for codex-cli/mcp-helpers.ts.
 * Targets `mapTomlServerToCanonical` guard branches (lines 13-19) and the
 * config.toml `mcp_servers` shape guard at lines 54-61, plus the empty-server
 * short-circuit at 66-69.
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  importMcp,
  mapTomlServerToCanonical,
} from '../../../../src/targets/codex-cli/mcp-helpers.js';
import { CODEX_CONFIG_TOML } from '../../../../src/targets/codex-cli/constants.js';
import type { ImportResult } from '../../../../src/core/types.js';

describe('mapTomlServerToCanonical — guard branches', () => {
  it('returns null for null input', () => {
    expect(mapTomlServerToCanonical(null)).toBeNull();
  });

  it('returns null for non-object inputs (string, number)', () => {
    expect(mapTomlServerToCanonical('cmd')).toBeNull();
    expect(mapTomlServerToCanonical(42)).toBeNull();
  });

  it('returns null when input is an array', () => {
    expect(mapTomlServerToCanonical(['cmd', 'arg'])).toBeNull();
  });

  it('returns null when command is missing or empty', () => {
    expect(mapTomlServerToCanonical({})).toBeNull();
    expect(mapTomlServerToCanonical({ command: '' })).toBeNull();
    expect(mapTomlServerToCanonical({ command: 42 })).toBeNull();
  });

  it('coerces missing args to []', () => {
    const out = mapTomlServerToCanonical({ command: 'node' });
    expect(out).toEqual({ type: 'stdio', command: 'node', args: [], env: {} });
  });

  it('filters non-string args entries', () => {
    const out = mapTomlServerToCanonical({ command: 'node', args: ['a', 1, 'b', null] });
    expect(out!.args).toEqual(['a', 'b']);
  });

  it('treats env=null as empty env (the !== null guard)', () => {
    const out = mapTomlServerToCanonical({ command: 'node', env: null });
    expect(out!.env).toEqual({});
  });

  it('treats env=array as empty env (Array.isArray guard)', () => {
    const out = mapTomlServerToCanonical({ command: 'node', env: ['a', 'b'] });
    expect(out!.env).toEqual({});
  });

  it('filters env entries whose values are not strings', () => {
    const out = mapTomlServerToCanonical({
      command: 'node',
      env: { GOOD: 'v', BAD: 1, NOPE: null, OK: 'x' },
    });
    expect(out!.env).toEqual({ GOOD: 'v', OK: 'x' });
  });
});

describe('importMcp — config.toml shape branches', () => {
  let projectRoot = '';

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'amesh-cov-'));
  });

  afterEach(() => {
    if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
    projectRoot = '';
  });

  it('does nothing when config.toml is absent', async () => {
    const results: ImportResult[] = [];
    await importMcp(projectRoot, results);
    expect(results).toEqual([]);
  });

  it('does nothing when mcp_servers is missing in config.toml', async () => {
    mkdirSync(join(projectRoot, '.codex'), { recursive: true });
    writeFileSync(join(projectRoot, CODEX_CONFIG_TOML), 'model = "gpt-5"\n');
    const results: ImportResult[] = [];
    await importMcp(projectRoot, results);
    expect(results).toEqual([]);
  });

  it('skips servers whose values fail mapping (no command field)', async () => {
    mkdirSync(join(projectRoot, '.codex'), { recursive: true });
    writeFileSync(
      join(projectRoot, CODEX_CONFIG_TOML),
      ['[mcp_servers.broken]', 'args = ["x"]'].join('\n'),
    );
    const results: ImportResult[] = [];
    await importMcp(projectRoot, results);
    // No usable servers → no result and no file written.
    expect(results).toEqual([]);
  });

  it('returns nothing when malformed TOML throws during parse', async () => {
    mkdirSync(join(projectRoot, '.codex'), { recursive: true });
    writeFileSync(join(projectRoot, CODEX_CONFIG_TOML), '[[[ bad toml');
    const results: ImportResult[] = [];
    await importMcp(projectRoot, results);
    expect(results).toEqual([]);
  });
});
