/**
 * Branch coverage for src/targets/opencode/importer.ts — parseOpenCodeMcp
 * private branches reached via importFromOpenCode end-to-end:
 * - Invalid JSON catch (line 47-48).
 * - mcp key missing / not an object.
 * - non-object server entries are skipped.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFromOpenCode } from '../../../../src/targets/opencode/importer.js';

let projectRoot = '';

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'am-opencode-importer-'));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('importFromOpenCode — parseOpenCodeMcp branches', () => {
  it('ignores opencode.json with invalid JSON (catch branch)', async () => {
    writeFileSync(join(projectRoot, 'opencode.json'), '{ not valid json');
    const results = await importFromOpenCode(projectRoot);
    // No MCP-related import result emitted.
    expect(results.find((r) => r.feature === 'mcp')).toBeUndefined();
  });

  it('ignores opencode.json with no mcp key', async () => {
    writeFileSync(join(projectRoot, 'opencode.json'), JSON.stringify({ other: true }));
    const results = await importFromOpenCode(projectRoot);
    expect(results.find((r) => r.feature === 'mcp')).toBeUndefined();
  });

  it('ignores opencode.json where mcp is an array', async () => {
    writeFileSync(join(projectRoot, 'opencode.json'), JSON.stringify({ mcp: ['nope'] }));
    const results = await importFromOpenCode(projectRoot);
    expect(results.find((r) => r.feature === 'mcp')).toBeUndefined();
  });

  it('skips mcp entries that are not objects or are null', async () => {
    writeFileSync(
      join(projectRoot, 'opencode.json'),
      JSON.stringify({
        mcp: {
          bogus: 'string-not-object',
          alsoNull: null,
          arr: ['no'],
        },
      }),
    );
    const results = await importFromOpenCode(projectRoot);
    expect(results.find((r) => r.feature === 'mcp')).toBeUndefined();
  });

  it('imports a url-type entry with headers and description', async () => {
    writeFileSync(
      join(projectRoot, 'opencode.json'),
      JSON.stringify({
        mcp: {
          web: {
            url: 'https://example.com',
            description: 'web server',
            headers: { Auth: 'tok', Bad: 1 },
            environment: { K: 'V' },
          },
        },
      }),
    );
    const results = await importFromOpenCode(projectRoot);
    const mcp = results.find((r) => r.feature === 'mcp');
    expect(mcp).toBeDefined();
  });

  it('imports a stdio command-array entry but skips empty command array', async () => {
    writeFileSync(
      join(projectRoot, 'opencode.json'),
      JSON.stringify({
        mcp: {
          local: { command: ['node', 'srv.js'], environment: { DEBUG: '1' } },
          broken: { command: [] },
        },
      }),
    );
    const results = await importFromOpenCode(projectRoot);
    expect(results.find((r) => r.feature === 'mcp')).toBeDefined();
  });

  it('returns no results when opencode.json is missing', async () => {
    const results = await importFromOpenCode(projectRoot);
    expect(results.find((r) => r.feature === 'mcp')).toBeUndefined();
  });
});
