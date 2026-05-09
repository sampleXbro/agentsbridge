import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFromTrae } from '../../../../src/targets/trae/importer.js';

function makeTmp(): string {
  const dir = join(tmpdir(), `trae-import-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('importFromTrae (project scope)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmp();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('imports project_rules.md as root rule', async () => {
    mkdirSync(join(tmpDir, '.trae', 'rules'), { recursive: true });
    mkdirSync(join(tmpDir, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(tmpDir, '.trae', 'rules', 'project_rules.md'),
      '# Project Rules\n\nUse TDD.',
    );

    const results = await importFromTrae(tmpDir, { scope: 'project' });

    const rootResult = results.find((r) => r.toPath === '.agentsmesh/rules/_root.md');
    expect(rootResult).toBeDefined();
    expect(rootResult?.feature).toBe('rules');
    expect(rootResult?.fromTool).toBe('trae');
  });

  it('imports non-root rules from .trae/rules/', async () => {
    mkdirSync(join(tmpDir, '.trae', 'rules'), { recursive: true });
    mkdirSync(join(tmpDir, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(join(tmpDir, '.trae', 'rules', 'project_rules.md'), '# Root');
    writeFileSync(join(tmpDir, '.trae', 'rules', 'typescript.md'), '# TypeScript\n\nUse strict.');

    const results = await importFromTrae(tmpDir, { scope: 'project' });

    const tsResult = results.find((r) => r.toPath === '.agentsmesh/rules/typescript.md');
    expect(tsResult).toBeDefined();
    expect(tsResult?.feature).toBe('rules');
  });

  it('returns empty results when no trae config found', async () => {
    mkdirSync(join(tmpDir, '.agentsmesh'), { recursive: true });
    const results = await importFromTrae(tmpDir, { scope: 'project' });
    expect(results).toHaveLength(0);
  });

  it('imports MCP config from .trae/mcp.json', async () => {
    mkdirSync(join(tmpDir, '.trae'), { recursive: true });
    mkdirSync(join(tmpDir, '.agentsmesh'), { recursive: true });
    writeFileSync(
      join(tmpDir, '.trae', 'mcp.json'),
      JSON.stringify({
        mcpServers: {
          github: { type: 'stdio', command: 'npx', args: ['-y', '@mcp/server-github'] },
        },
      }),
    );

    const results = await importFromTrae(tmpDir, { scope: 'project' });

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeDefined();
    expect(mcpResult?.toPath).toBe('.agentsmesh/mcp.json');
  });

  it('imports ignore entries from .trae/.ignore', async () => {
    mkdirSync(join(tmpDir, '.trae'), { recursive: true });
    mkdirSync(join(tmpDir, '.agentsmesh'), { recursive: true });
    writeFileSync(join(tmpDir, '.trae', '.ignore'), 'node_modules\n.env\ndist/');

    const results = await importFromTrae(tmpDir, { scope: 'project' });

    const ignoreResult = results.find((r) => r.feature === 'ignore');
    expect(ignoreResult).toBeDefined();
    expect(ignoreResult?.toPath).toBe('.agentsmesh/ignore');
  });
});
