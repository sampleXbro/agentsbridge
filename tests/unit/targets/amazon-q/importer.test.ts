import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importFromAmazonQ } from '../../../../src/targets/amazon-q/importer.js';

function createTempDir(): string {
  const dir = join(
    tmpdir(),
    `amazon-q-importer-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('importFromAmazonQ', () => {
  it('imports rules from .amazonq/rules/ directory', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.amazonq', 'rules'), { recursive: true });
    writeFileSync(join(dir, '.amazonq', 'rules', '_root.md'), '# Root\n\nProject standards.');
    writeFileSync(join(dir, '.amazonq', 'rules', 'typescript.md'), '# TypeScript\n\nUse strict.');

    const results = await importFromAmazonQ(dir);

    const ruleResults = results.filter((r) => r.feature === 'rules');
    expect(ruleResults).toHaveLength(2);

    const paths = ruleResults.map((r) => r.toPath).sort();
    expect(paths[0]).toBe('.agentsmesh/rules/_root.md');
    expect(paths[1]).toBe('.agentsmesh/rules/typescript.md');
  });

  it('imports MCP from .amazonq/mcp.json', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.amazonq'), { recursive: true });
    writeFileSync(
      join(dir, '.amazonq', 'mcp.json'),
      JSON.stringify({
        mcpServers: {
          context7: { command: 'npx', args: ['-y', '@upstash/context7-mcp@latest'], env: {} },
        },
      }),
    );

    const results = await importFromAmazonQ(dir);

    const mcpResults = results.filter((r) => r.feature === 'mcp');
    expect(mcpResults).toHaveLength(1);
    expect(mcpResults[0].toPath).toBe('.agentsmesh/mcp.json');
  });

  it('returns empty array when .amazonq/ does not exist', async () => {
    const dir = createTempDir();
    const results = await importFromAmazonQ(dir);
    expect(results).toHaveLength(0);
  });

  it('imports an agent prompt body from .amazonq/cli-agents/ (official prompt key)', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.amazonq', 'cli-agents'), { recursive: true });
    writeFileSync(
      join(dir, '.amazonq', 'cli-agents', 'reviewer.json'),
      JSON.stringify({
        name: 'reviewer',
        description: 'Reviews code',
        prompt: 'You review code carefully.',
        allowedTools: ['Read'],
      }),
    );

    const results = await importFromAmazonQ(dir);

    const agentResults = results.filter((r) => r.feature === 'agents');
    expect(agentResults).toHaveLength(1);
    expect(agentResults[0].toPath).toBe('.agentsmesh/agents/reviewer.md');
    const body = readFileSync(join(dir, '.agentsmesh', 'agents', 'reviewer.md'), 'utf-8');
    expect(body).toContain('You review code carefully.');
  });

  it('still imports the legacy systemPrompt key for backward compatibility', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.amazonq', 'cli-agents'), { recursive: true });
    writeFileSync(
      join(dir, '.amazonq', 'cli-agents', 'legacy.json'),
      JSON.stringify({ name: 'legacy', systemPrompt: 'Legacy body.' }),
    );

    const results = await importFromAmazonQ(dir);

    const agentResults = results.filter((r) => r.feature === 'agents');
    expect(agentResults).toHaveLength(1);
    const body = readFileSync(join(dir, '.agentsmesh', 'agents', 'legacy.md'), 'utf-8');
    expect(body).toContain('Legacy body.');
  });

  it('imports rules in global scope from .aws/amazonq/rules/', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.aws', 'amazonq', 'rules'), { recursive: true });
    writeFileSync(
      join(dir, '.aws', 'amazonq', 'rules', 'global-standards.md'),
      '# Global Standards\n\nApplied to all projects.',
    );

    const results = await importFromAmazonQ(dir, { scope: 'global' });

    const ruleResults = results.filter((r) => r.feature === 'rules');
    expect(ruleResults).toHaveLength(1);
    expect(ruleResults[0].toPath).toBe('.agentsmesh/rules/global-standards.md');
  });

  it('imports MCP in global scope from .aws/amazonq/mcp.json', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, '.aws', 'amazonq'), { recursive: true });
    writeFileSync(
      join(dir, '.aws', 'amazonq', 'mcp.json'),
      JSON.stringify({
        mcpServers: {
          github: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], env: {} },
        },
      }),
    );

    const results = await importFromAmazonQ(dir, { scope: 'global' });

    const mcpResults = results.filter((r) => r.feature === 'mcp');
    expect(mcpResults).toHaveLength(1);
    expect(mcpResults[0].toPath).toBe('.agentsmesh/mcp.json');
  });
});
