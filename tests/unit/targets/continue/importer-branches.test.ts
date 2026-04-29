import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFromContinue } from '../../../../src/targets/continue/importer.js';

let projectRoot: string;

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'amesh-rem-continue-'));
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

function writeFile(rel: string, content: string): void {
  const abs = join(projectRoot, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, content);
}

describe('continue importer — extra branches', () => {
  it('imports YAML mcp servers (line 20 ?? {} branch)', async () => {
    // Empty YAML document parses to null; the `?? {}` covers that.
    writeFile('.continue/mcpServers/empty.yaml', '');
    writeFile('.continue/mcpServers/x.yaml', 'mcpServers:\n  x:\n    command: node\n');
    const results = await importFromContinue(projectRoot);
    expect(results.some((r) => r.feature === 'mcp')).toBe(true);
    expect(existsSync(join(projectRoot, '.agentsmesh/mcp.json'))).toBe(true);
  });

  it('skips files without mcpServers key (line 23 true)', async () => {
    writeFile('.continue/mcpServers/no-mcp.json', '{"other": 1}');
    const results = await importFromContinue(projectRoot);
    expect(results.find((r) => r.feature === 'mcp')).toBeUndefined();
  });

  it('skips servers that are not objects (line 26 true)', async () => {
    writeFile(
      '.continue/mcpServers/odd.json',
      JSON.stringify({ mcpServers: { stringValue: 'no-object', validOne: { command: 'node' } } }),
    );
    const results = await importFromContinue(projectRoot);
    expect(results.some((r) => r.feature === 'mcp')).toBe(true);
    // valid server should be present
    expect(results.find((r) => r.feature === 'mcp')?.toPath).toContain('mcp.json');
  });

  it('skips empty file content during merge (line 53 true)', async () => {
    writeFile('.continue/mcpServers/empty.json', '');
    writeFile(
      '.continue/mcpServers/good.json',
      JSON.stringify({ mcpServers: { x: { command: 'node' } } }),
    );
    const results = await importFromContinue(projectRoot);
    expect(results.some((r) => r.feature === 'mcp')).toBe(true);
  });

  it('skips when no mcp directory exists', async () => {
    const results = await importFromContinue(projectRoot);
    expect(results.find((r) => r.feature === 'mcp')).toBeUndefined();
  });

  it('skips servers with non-string command (line 28 continue)', async () => {
    writeFile(
      '.continue/mcpServers/mixed.json',
      JSON.stringify({
        mcpServers: {
          bad: { command: 42 },
          good: { command: 'node' },
        },
      }),
    );
    const results = await importFromContinue(projectRoot);
    expect(results.some((r) => r.feature === 'mcp')).toBe(true);
  });
});
