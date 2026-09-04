import { describe, it, expect, afterEach } from 'vitest';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runGenerate } from '../../../../src/cli/commands/generate.js';
import { importFromKimiCode } from '../../../../src/targets/kimi-code/importer.js';
import { listFilesRecursive } from '../../../contract/matrix-helpers.js';

const FIXTURE = join(process.cwd(), 'tests', 'e2e', 'fixtures', 'kimi-code-project');

let dir = '';

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = '';
});

function copyFixture(): string {
  dir = mkdtempSync(join(tmpdir(), 'kimi-fixture-'));
  cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}

function read(root: string, rel: string): string {
  return readFileSync(join(root, rel), 'utf-8');
}

describe('importing the kimi-code fixture project', () => {
  it('lands every native surface in canonical', async () => {
    const root = copyFixture();
    await importFromKimiCode(root, { scope: 'project' });

    expect(
      listFilesRecursive(join(root, '.agentsmesh'))
        .map((file) => `.agentsmesh/${file}`)
        .sort(),
    ).toEqual([
      '.agentsmesh/agents/code-reviewer.md',
      '.agentsmesh/agents/researcher.md',
      '.agentsmesh/commands/review.md',
      '.agentsmesh/mcp.json',
      '.agentsmesh/rules/_root.md',
      '.agentsmesh/rules/sql.md',
      '.agentsmesh/rules/typescript.md',
      '.agentsmesh/skills/api-generator/SKILL.md',
      '.agentsmesh/skills/api-generator/references/route-checklist.md',
      '.agentsmesh/skills/api-generator/scripts/scaffold.ts',
    ]);
  });

  it('keeps both instruction files Kimi Code concatenates', async () => {
    const root = copyFixture();
    await importFromKimiCode(root, { scope: 'project' });
    const canonicalRoot = read(root, '.agentsmesh/rules/_root.md');
    expect(canonicalRoot).toContain('Node 22 + TypeScript service');
    expect(canonicalRoot).toContain('The staging database is reset every night');
    expect(canonicalRoot).not.toContain('agentsmesh:embedded-rule');
  });

  it('restores each embedded rule with its own metadata', async () => {
    const root = copyFixture();
    await importFromKimiCode(root, { scope: 'project' });

    const ts = read(root, '.agentsmesh/rules/typescript.md');
    expect(ts).toContain('description: TypeScript standards');
    expect(ts).toContain('globs:\n  - src/**/*.ts');
    expect(ts).toContain('use `unknown` plus a narrowing guard');

    const sql = read(root, '.agentsmesh/rules/sql.md');
    expect(sql).toContain('description: Database access');
    expect(sql).toContain('kimi-code');
    expect(sql).toContain('repository layer');
  });

  it('keeps all three MCP transports and rewrites references to canonical paths', async () => {
    const root = copyFixture();
    await importFromKimiCode(root, { scope: 'project' });

    const mcp = JSON.parse(read(root, '.agentsmesh/mcp.json'));
    expect(Object.keys(mcp.mcpServers).sort()).toEqual([
      'context7',
      'order-events',
      'orders-staging',
    ]);
    expect(mcp.mcpServers.context7).toMatchObject({ type: 'stdio', command: 'npx' });
    expect(mcp.mcpServers['orders-staging']).toMatchObject({
      type: 'http',
      url: 'https://staging.internal.example.com/mcp',
    });
    expect(mcp.mcpServers['order-events']).toMatchObject({
      type: 'sse',
      url: 'https://events.internal.example.com/sse',
    });

    const canonicalRoot = read(root, '.agentsmesh/rules/_root.md');
    expect(canonicalRoot).toContain('.agentsmesh/skills/api-generator/SKILL.md');
    expect(canonicalRoot).toContain('.agentsmesh/agents/code-reviewer.md');
    expect(canonicalRoot).not.toContain('.kimi-code/');
  });

  it('turns the projected skill back into a command, not a skill', async () => {
    const root = copyFixture();
    await importFromKimiCode(root, { scope: 'project' });
    const command = read(root, '.agentsmesh/commands/review.md');
    expect(command).toContain('description: Review the working tree');
    expect(command).toContain('git diff --stat');
    expect(listFilesRecursive(join(root, '.agentsmesh/skills'))).not.toContain(
      'am-command-review/SKILL.md',
    );
  });

  it('import -> generate leaves one instruction file with every rule in it', async () => {
    const root = copyFixture();
    writeFileSync(
      join(root, 'agentsmesh.yaml'),
      'version: 1\ntargets: [kimi-code]\nfeatures: [rules, commands, agents, skills, mcp]\n',
    );
    await importFromKimiCode(root, { scope: 'project' });
    expect((await runGenerate({}, root, { printMatrix: false })).exitCode).toBe(0);

    const instructions = read(root, 'AGENTS.md');
    expect(instructions).toContain('Node 22 + TypeScript service');
    expect(instructions).toContain('The staging database is reset every night');
    expect(instructions).toContain('\n<!-- agentsmesh:embedded-rules:start -->');
    expect(existsSync(join(root, '.kimi-code/AGENTS.md'))).toBe(false);
  });

  it('carries the native agent frontmatter through', async () => {
    const root = copyFixture();
    await importFromKimiCode(root, { scope: 'project' });
    const agent = read(root, '.agentsmesh/agents/code-reviewer.md');
    expect(agent).toContain('name: code-reviewer');
    expect(agent).toContain('disallowedTools:');
    expect(agent).toContain('You review changes, you do not write them.');
  });
});
