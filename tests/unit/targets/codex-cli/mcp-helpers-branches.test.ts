/**
 * Branch coverage tests for codex-cli/mcp-helpers.ts.
 * Targets `mapTomlServerToCanonical` guard branches (lines 13-19) and the
 * config.toml `mcp_servers` shape guard at lines 54-61, plus the empty-server
 * short-circuit at 66-69.
 */

import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  importMcp,
  mapTomlServerToCanonical,
  mapUrlTomlServerToCanonical,
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

describe('mapUrlTomlServerToCanonical — remote (url) transport', () => {
  it('returns null for null/non-object/array input', () => {
    expect(mapUrlTomlServerToCanonical(null)).toBeNull();
    expect(mapUrlTomlServerToCanonical('x')).toBeNull();
    expect(mapUrlTomlServerToCanonical(['x'])).toBeNull();
  });

  it('returns null when url is missing or empty', () => {
    expect(mapUrlTomlServerToCanonical({})).toBeNull();
    expect(mapUrlTomlServerToCanonical({ url: '' })).toBeNull();
  });

  it('maps a bare url server with empty headers', () => {
    expect(mapUrlTomlServerToCanonical({ url: 'https://example.com/mcp' })).toEqual({
      type: 'http',
      url: 'https://example.com/mcp',
      headers: {},
      env: {},
    });
  });

  it('reconstructs bearer_token_env_var as an Authorization header', () => {
    const out = mapUrlTomlServerToCanonical({
      url: 'https://api.githubcopilot.com/mcp/',
      bearer_token_env_var: 'GITHUB_PAT',
    });
    expect(out!.headers).toEqual({ Authorization: 'Bearer ${GITHUB_PAT}' });
  });

  it('merges http_headers with a reconstructed bearer header', () => {
    const out = mapUrlTomlServerToCanonical({
      url: 'https://example.com/mcp',
      http_headers: { 'X-Custom': 'value' },
      bearer_token_env_var: 'TOKEN',
    });
    expect(out!.headers).toEqual({ 'X-Custom': 'value', Authorization: 'Bearer ${TOKEN}' });
  });

  it('filters non-string http_headers entries', () => {
    const out = mapUrlTomlServerToCanonical({
      url: 'https://example.com/mcp',
      http_headers: { GOOD: 'v', BAD: 1 },
    });
    expect(out!.headers).toEqual({ GOOD: 'v' });
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

  it('skips servers whose values fail mapping (no command or url field)', async () => {
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

  it('imports a remote (url) server via the url fallback mapper', async () => {
    mkdirSync(join(projectRoot, '.codex'), { recursive: true });
    writeFileSync(
      join(projectRoot, CODEX_CONFIG_TOML),
      [
        '[mcp_servers.github]',
        'url = "https://api.githubcopilot.com/mcp/"',
        'bearer_token_env_var = "GITHUB_PAT"',
      ].join('\n'),
    );
    const results: ImportResult[] = [];
    await importMcp(projectRoot, results);
    expect(results).toHaveLength(1);
    const mcpJson = JSON.parse(
      readFileSync(join(projectRoot, '.agentsmesh', 'mcp.json'), 'utf-8'),
    ) as { mcpServers: Record<string, { url: string; headers: Record<string, string> }> };
    expect(mcpJson.mcpServers.github!.url).toBe('https://api.githubcopilot.com/mcp/');
    expect(mcpJson.mcpServers.github!.headers).toEqual({ Authorization: 'Bearer ${GITHUB_PAT}' });
  });

  it('returns nothing when malformed TOML throws during parse', async () => {
    mkdirSync(join(projectRoot, '.codex'), { recursive: true });
    writeFileSync(join(projectRoot, CODEX_CONFIG_TOML), '[[[ bad toml');
    const results: ImportResult[] = [];
    await importMcp(projectRoot, results);
    expect(results).toEqual([]);
  });
});
