/**
 * Branch coverage for src/canonical/features/mcp.ts JSONC comment-stripping paths:
 * - Block comments /* ... *\/
 * - Line comments //
 * - Escaped characters inside JSON string literals (\\ \" \n)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseMcp } from '../../../src/canonical/features/mcp.js';

let dir: string;
let mcpPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'amesh-cov-mcp-jsonc-'));
  mkdirSync(join(dir, '.agentsmesh'), { recursive: true });
  mcpPath = join(dir, '.agentsmesh', 'mcp.json');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('parseMcp — JSONC comment-stripping branches', () => {
  it('strips // line comments before parsing', async () => {
    writeFileSync(
      mcpPath,
      [
        '// top-level comment',
        '{',
        '  "mcpServers": { // server map',
        '    "srv": { "command": "cmd" } // entry',
        '  }',
        '}',
      ].join('\n'),
    );
    const result = await parseMcp(mcpPath);
    expect(result?.mcpServers.srv?.type).toBe('stdio');
  });

  it('strips /* block */ comments (single line)', async () => {
    writeFileSync(mcpPath, '/* comment */ { "mcpServers": { "srv": { "command": "cmd" } } }');
    const result = await parseMcp(mcpPath);
    expect(result?.mcpServers.srv).toBeDefined();
  });

  it('strips /* multi-line block */ comments', async () => {
    writeFileSync(
      mcpPath,
      ['/*', '  multi', '  line', '*/', '{ "mcpServers": { "srv": { "command": "cmd" } } }'].join(
        '\n',
      ),
    );
    const result = await parseMcp(mcpPath);
    expect(result?.mcpServers.srv).toBeDefined();
  });

  it('preserves // inside string literals (URL not treated as comment)', async () => {
    writeFileSync(mcpPath, '{ "mcpServers": { "web": { "url": "https://example.com/path" } } }');
    const result = await parseMcp(mcpPath);
    expect((result?.mcpServers.web as { url: string }).url).toBe('https://example.com/path');
  });

  it('preserves escaped backslash and quote inside JSON string literals', async () => {
    writeFileSync(
      mcpPath,
      '{ "mcpServers": { "srv": { "command": "c:\\\\bin\\\\node.exe", "args": ["a\\"b"] } } }',
    );
    const result = await parseMcp(mcpPath);
    // After JSON parse, \\\\ becomes \\ in the actual string.
    expect((result?.mcpServers.srv as { command: string }).command).toContain('c:\\bin\\node.exe');
  });
});
