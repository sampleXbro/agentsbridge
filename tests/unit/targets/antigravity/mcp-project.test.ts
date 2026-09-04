/**
 * Workspace-local MCP (GAP 1). antigravity.google/docs/mcp/ documents
 * `.agents/mcp_config.json` for workspace setups; project emission used to be
 * suppressed because no project path was published.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { emitAntigravityMcp } from '../../../../src/targets/antigravity/mcp-settings.js';
import { importFromAntigravity } from '../../../../src/targets/antigravity/importer.js';
import { getTargetCapabilities } from '../../../../src/targets/catalog/builtin-targets.js';
import { resolveGeneratedOutputPath } from '../../../../src/core/generate/feature-loop.js';
import { ANTIGRAVITY_MCP_CONFIG } from '../../../../src/targets/antigravity/constants.js';

const TEST_DIR = join(tmpdir(), 'am-antigravity-mcp-project-test');

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

function emitMcp(canonical: CanonicalFiles): readonly { path: string; content: string }[] {
  return emitAntigravityMcp(canonical, 'project', new Set(['mcp']));
}

describe('antigravity project MCP', () => {
  it('declares mcp native at project scope', () => {
    expect(getTargetCapabilities('antigravity', 'project')!.mcp.level).toBe('native');
  });

  it('emits .agents/mcp_config.json with an mcpServers key', () => {
    const results = emitMcp(
      makeCanonical({
        mcp: {
          mcpServers: { docs: { type: 'stdio', command: 'npx', args: ['-y', 'x'], env: {} } },
        },
      }),
    );
    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe('.agents/mcp_config.json');
    expect(Object.keys(JSON.parse(results[0]!.content) as object)).toEqual(['mcpServers']);
  });

  it('no longer suppresses the project MCP path', () => {
    expect(resolveGeneratedOutputPath('antigravity', ANTIGRAVITY_MCP_CONFIG, 'project')).toBe(
      '.agents/mcp_config.json',
    );
  });

  it('writes remote servers with Antigravity serverUrl instead of canonical url', () => {
    const results = emitMcp(
      makeCanonical({
        mcp: {
          mcpServers: {
            remote: { type: 'http', url: 'https://x/mcp', headers: { A: 'b' }, env: {} },
          },
        },
      }),
    );
    const parsed = JSON.parse(results[0]!.content) as {
      mcpServers: Record<string, Record<string, unknown>>;
    };
    expect(parsed.mcpServers.remote).toEqual({ serverUrl: 'https://x/mcp', headers: { A: 'b' } });
  });

  it('writes stdio servers with command, args and env only', () => {
    const results = emitMcp(
      makeCanonical({
        mcp: {
          mcpServers: {
            docs: { type: 'stdio', command: 'npx', args: ['-y', 'x'], env: { TOKEN: 't' } },
          },
        },
      }),
    );
    const parsed = JSON.parse(results[0]!.content) as {
      mcpServers: Record<string, Record<string, unknown>>;
    };
    expect(parsed.mcpServers.docs).toEqual({
      command: 'npx',
      args: ['-y', 'x'],
      env: { TOKEN: 't' },
    });
  });
});

describe('importFromAntigravity — project MCP', () => {
  beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
  afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

  it('imports .agents/mcp_config.json into canonical mcp.json', async () => {
    mkdirSync(join(TEST_DIR, '.agents'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, ANTIGRAVITY_MCP_CONFIG),
      JSON.stringify({ mcpServers: { docs: { command: 'npx', args: ['-y', 'x'] } } }, null, 2),
    );

    const results = await importFromAntigravity(TEST_DIR);
    const mcp = results.filter((r) => r.feature === 'mcp');
    expect(mcp).toHaveLength(1);
    expect(mcp[0]!.toPath).toBe('.agentsmesh/mcp.json');
    const parsed = JSON.parse(readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf-8')) as {
      mcpServers: Record<string, unknown>;
    };
    expect(Object.keys(parsed.mcpServers)).toEqual(['docs']);
  });

  it('merges rather than replacing canonical servers owned by other tools', async () => {
    mkdirSync(join(TEST_DIR, '.agentsmesh'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'mcp.json'),
      JSON.stringify(
        { mcpServers: { other: { type: 'stdio', command: 'other', args: [], env: {} } } },
        null,
        2,
      ),
    );
    mkdirSync(join(TEST_DIR, '.agents'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, ANTIGRAVITY_MCP_CONFIG),
      JSON.stringify({ mcpServers: { docs: { command: 'npx', args: [] } } }, null, 2),
    );

    await importFromAntigravity(TEST_DIR);
    const parsed = JSON.parse(readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf-8')) as {
      mcpServers: Record<string, unknown>;
    };
    expect(Object.keys(parsed.mcpServers).sort()).toEqual(['docs', 'other']);
  });

  it('imports remote servers declared with serverUrl and headers', async () => {
    mkdirSync(join(TEST_DIR, '.agents'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, ANTIGRAVITY_MCP_CONFIG),
      JSON.stringify(
        { mcpServers: { remote: { serverUrl: 'https://x/mcp', headers: { A: 'b' } } } },
        null,
        2,
      ),
    );

    await importFromAntigravity(TEST_DIR);
    const parsed = JSON.parse(readFileSync(join(TEST_DIR, '.agentsmesh', 'mcp.json'), 'utf-8')) as {
      mcpServers: Record<string, { url?: string; headers?: Record<string, string> }>;
    };
    expect(parsed.mcpServers.remote!.url).toBe('https://x/mcp');
    expect(parsed.mcpServers.remote!.headers).toEqual({ A: 'b' });
  });
});
