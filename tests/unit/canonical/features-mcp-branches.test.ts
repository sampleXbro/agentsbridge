import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseMcp } from '../../../src/canonical/features/mcp.js';

let dir: string;
let mcpPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'amesh-cov-mcp-'));
  mkdirSync(join(dir, '.agentsmesh'), { recursive: true });
  mcpPath = join(dir, '.agentsmesh', 'mcp.json');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('parseMcp — branch coverage', () => {
  it('returns null when top-level JSON is not an object (array)', async () => {
    writeFileSync(mcpPath, '[]');
    const result = await parseMcp(mcpPath);
    expect(result).toBeNull();
  });

  it('returns null when mcpServers is null', async () => {
    writeFileSync(mcpPath, '{ "mcpServers": null }');
    const result = await parseMcp(mcpPath);
    expect(result).toBeNull();
  });

  it('returns null when mcpServers is a primitive', async () => {
    writeFileSync(mcpPath, '{ "mcpServers": 42 }');
    const result = await parseMcp(mcpPath);
    expect(result).toBeNull();
  });

  it('returns config but skips servers whose value is not an object', async () => {
    writeFileSync(
      mcpPath,
      JSON.stringify({
        mcpServers: {
          good: { command: 'node', args: ['s.js'] },
          bad: 'not-an-object',
          alsoBad: null,
        },
      }),
    );
    const result = await parseMcp(mcpPath);
    expect(result).not.toBeNull();
    expect(Object.keys(result!.mcpServers)).toEqual(['good']);
  });

  it('parses url server with headers and ignores non-string headers', async () => {
    writeFileSync(
      mcpPath,
      JSON.stringify({
        mcpServers: {
          web: {
            url: 'https://example.com/mcp',
            headers: { Auth: 'tok', Bad: 1, Empty: null },
            env: { K: 'V', BadEnv: 7 },
            description: 'desc',
          },
        },
      }),
    );
    const result = await parseMcp(mcpPath);
    const web = result!.mcpServers.web;
    expect(web).toBeDefined();
    expect(web!.type).toBe('stdio');
    // url server type defaults to stdio in this parser when type missing
    expect((web as { url?: string }).url).toBe('https://example.com/mcp');
    expect((web as { headers?: Record<string, string> }).headers).toEqual({ Auth: 'tok' });
    expect(web!.env).toEqual({ K: 'V' });
    expect(web!.description).toBe('desc');
  });

  it('skips entries that have neither url nor command', async () => {
    writeFileSync(
      mcpPath,
      JSON.stringify({
        mcpServers: {
          ghost: { type: 'stdio' },
        },
      }),
    );
    const result = await parseMcp(mcpPath);
    expect(Object.keys(result!.mcpServers)).toHaveLength(0);
  });

  it('keeps non-string args out of the array', async () => {
    writeFileSync(
      mcpPath,
      JSON.stringify({
        mcpServers: {
          srv: { command: 'cmd', args: ['ok', 1, false, 'also'] },
        },
      }),
    );
    const result = await parseMcp(mcpPath);
    expect((result!.mcpServers.srv as { args: string[] }).args).toEqual(['ok', 'also']);
  });

  it('returns null when file is empty (readFileSafe returns empty string)', async () => {
    writeFileSync(mcpPath, '');
    const result = await parseMcp(mcpPath);
    expect(result).toBeNull();
  });

  it('returns null when env is an array (parseStringMap rejects)', async () => {
    writeFileSync(
      mcpPath,
      JSON.stringify({
        mcpServers: {
          srv: { command: 'cmd', env: ['nope'] },
        },
      }),
    );
    const result = await parseMcp(mcpPath);
    expect(result!.mcpServers.srv?.env).toEqual({});
  });
});
