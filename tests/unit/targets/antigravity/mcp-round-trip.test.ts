/**
 * MCP data-flow guards: generate -> write -> import -> generate must be a fixed
 * point, and generate must not wipe the Antigravity-only per-server keys
 * documented at antigravity.google/docs/mcp/ (`cwd`, `disabled`, `disabledTools`,
 * `oauth`, `authProviderType`).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { CanonicalFiles, GenerateResult } from '../../../../src/core/types.js';
import { importFromAntigravity } from '../../../../src/targets/antigravity/importer.js';
import { generateScopedSettingsFeature } from '../../../../src/core/generate/optional-features.js';
import { ANTIGRAVITY_MCP_CONFIG } from '../../../../src/targets/antigravity/constants.js';

const TEST_DIR = join(tmpdir(), 'am-antigravity-mcp-round-trip-test');

function makeCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
    ...overrides,
  };
}

async function runMcpGenerate(canonical: CanonicalFiles): Promise<GenerateResult[]> {
  const results: GenerateResult[] = [];
  await generateScopedSettingsFeature(
    results,
    ['antigravity'],
    canonical,
    TEST_DIR,
    'project',
    new Set(['mcp']),
  );
  return results;
}

function readGenerated(results: GenerateResult[]): Record<string, Record<string, unknown>> {
  const result = results.find((r) => r.path === ANTIGRAVITY_MCP_CONFIG);
  expect(result).toBeDefined();
  const parsed = JSON.parse(result!.content) as {
    mcpServers: Record<string, Record<string, unknown>>;
  };
  return parsed.mcpServers;
}

describe('antigravity MCP round-trip', () => {
  beforeEach(() => {
    mkdirSync(join(TEST_DIR, '.agents'), { recursive: true });
    mkdirSync(join(TEST_DIR, '.agentsmesh'), { recursive: true });
  });
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

  it('is a fixed point for canonical fields Antigravity cannot express', async () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: {
          remote: {
            type: 'sse',
            url: 'https://api.example.com/mcp/',
            headers: { Authorization: 'Bearer t' },
            env: {},
            description: 'Prod search index',
          },
          docs: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', 'x'],
            env: {},
            description: 'Local docs',
          },
        },
      },
    });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'mcp.json'),
      JSON.stringify(canonical.mcp, null, 2),
    );

    const results = await runMcpGenerate(canonical);
    writeFileSync(join(TEST_DIR, ANTIGRAVITY_MCP_CONFIG), results[0]!.content);
    await importFromAntigravity(TEST_DIR);

    const reImported = JSON.parse(
      readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf-8'),
    ) as CanonicalFiles['mcp'];
    expect(reImported).toEqual(canonical.mcp);
  });

  it('never writes the legacy url key Antigravity rejects for remote servers', async () => {
    const results = await runMcpGenerate(
      makeCanonical({
        mcp: {
          mcpServers: {
            remote: { type: 'sse', url: 'https://x/mcp', headers: {}, env: {} },
          },
        },
      }),
    );
    expect(readGenerated(results).remote).toEqual({ serverUrl: 'https://x/mcp' });
  });

  it('preserves Antigravity-only keys already on disk for a canonical server', async () => {
    writeFileSync(
      join(TEST_DIR, ANTIGRAVITY_MCP_CONFIG),
      JSON.stringify(
        {
          mcpServers: {
            docs: {
              command: 'old',
              args: [],
              cwd: '/srv/docs',
              disabled: true,
              disabledTools: ['dangerous'],
            },
          },
        },
        null,
        2,
      ),
    );

    const results = await runMcpGenerate(
      makeCanonical({
        mcp: {
          mcpServers: { docs: { type: 'stdio', command: 'npx', args: ['-y', 'x'], env: {} } },
        },
      }),
    );

    expect(readGenerated(results).docs).toEqual({
      command: 'npx',
      args: ['-y', 'x'],
      cwd: '/srv/docs',
      disabled: true,
      disabledTools: ['dangerous'],
    });
  });

  it('drops owned keys of the previous kind when a server flips local to remote', async () => {
    writeFileSync(
      join(TEST_DIR, ANTIGRAVITY_MCP_CONFIG),
      JSON.stringify({ mcpServers: { docs: { command: 'old', args: ['a'], disabled: true } } }),
    );

    const results = await runMcpGenerate(
      makeCanonical({
        mcp: {
          mcpServers: { docs: { type: 'http', url: 'https://x/mcp', headers: {}, env: {} } },
        },
      }),
    );

    expect(readGenerated(results).docs).toEqual({ serverUrl: 'https://x/mcp', disabled: true });
  });

  it('revokes a server removed from canonical even though it merges', async () => {
    writeFileSync(
      join(TEST_DIR, ANTIGRAVITY_MCP_CONFIG),
      JSON.stringify({
        mcpServers: {
          docs: { command: 'npx', args: [] },
          gone: { command: 'rm', args: ['-rf'] },
        },
      }),
    );

    const results = await runMcpGenerate(
      makeCanonical({
        mcp: { mcpServers: { docs: { type: 'stdio', command: 'npx', args: [], env: {} } } },
      }),
    );

    expect(Object.keys(readGenerated(results))).toEqual(['docs']);
  });

  it('imports a hand-written description but lets canonical keep the last word', async () => {
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'mcp.json'),
      JSON.stringify({
        mcpServers: {
          owned: { type: 'stdio', command: 'npx', args: [], env: {}, description: 'canonical' },
        },
      }),
    );
    writeFileSync(
      join(TEST_DIR, ANTIGRAVITY_MCP_CONFIG),
      JSON.stringify({
        mcpServers: {
          owned: { command: 'npx', args: [], description: 'hand written' },
          fresh: { command: 'other', args: [], description: 'hand written too' },
        },
      }),
    );

    await importFromAntigravity(TEST_DIR);
    const servers = (
      JSON.parse(readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf-8')) as {
        mcpServers: Record<string, { description?: string }>;
      }
    ).mcpServers;
    expect(servers.owned!.description).toBe('canonical');
    expect(servers.fresh!.description).toBe('hand written too');
  });

  it('emits nothing when the mcp feature is disabled', async () => {
    const results: GenerateResult[] = [];
    await generateScopedSettingsFeature(
      results,
      ['antigravity'],
      makeCanonical({
        mcp: { mcpServers: { docs: { type: 'stdio', command: 'npx', args: [], env: {} } } },
      }),
      TEST_DIR,
      'project',
      new Set(['rules']),
    );
    expect(results).toEqual([]);
  });
});
