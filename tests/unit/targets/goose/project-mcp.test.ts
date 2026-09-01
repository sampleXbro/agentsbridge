/**
 * Goose project-scope MCP: `.agents/plugins/agentsmesh/.mcp.json`.
 *
 * `crates/goose/src/plugins/mcp_servers.rs` reads `DEFAULT_MCP_CONFIG = ".mcp.json"`
 * from every discovered plugin root, keyed by a top-level `mcpServers` map, and
 * `goose-cli/src/session/builder.rs` calls `enabled_plugin_mcp_servers(project_root)`
 * for each new session. Project plugins live at `<project>/.agents/plugins/<name>/`
 * and are enabled by default, so agentsmesh reuses its existing `agentsmesh` plugin
 * dir (the one already holding `hooks/hooks.json`).
 *
 * `McpServerConfig` only models stdio (`command` / `args` / `env` / `cwd`), and
 * `command` is required — a remote entry would fail deserialization of the whole
 * file. Remote servers are therefore omitted and named in a lint warning.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import type { McpServer } from '../../../../src/core/mcp-types.js';
import { serializeGooseProjectMcp } from '../../../../src/targets/goose/mcp-format.js';
import { lintMcp } from '../../../../src/targets/goose/lint.js';
import { importFromGoose } from '../../../../src/targets/goose/importer.js';
import { descriptor } from '../../../../src/targets/goose/index.js';
import { findStaleGeneratedOutputs } from '../../../../src/core/generate/stale-cleanup.js';
import { GOOSE_PROJECT_MCP_FILE } from '../../../../src/targets/goose/constants.js';

const roots: string[] = [];

function setupFixture(files: Record<string, string>): string {
  const root = join(
    tmpdir(),
    `goose-project-mcp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(join(root, '.agentsmesh'), { recursive: true });
  roots.push(root);
  for (const [relativePath, content] of Object.entries(files)) {
    const absPath = join(root, relativePath);
    mkdirSync(join(absPath, '..'), { recursive: true });
    writeFileSync(absPath, content, 'utf-8');
  }
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function makeCanonical(mcpServers: Record<string, McpServer> | null): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: mcpServers === null ? null : { mcpServers },
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

const stdio: McpServer = {
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
  env: { API_KEY: 'abc' },
  description: 'Filesystem access',
};

const remote: McpServer = {
  type: 'streamable_http',
  url: 'https://mcp.example.com/sse',
  headers: { Authorization: 'Bearer x' },
  env: {},
};

function generated(servers: Record<string, McpServer>): string {
  return serializeGooseProjectMcp({ mcpServers: servers });
}

describe('serializeGooseProjectMcp', () => {
  it('writes a top-level mcpServers map', () => {
    expect(JSON.parse(generated({ filesystem: stdio }))).toEqual({
      mcpServers: { filesystem: stdio },
    });
  });

  it('omits remote servers the plugin parser cannot deserialize', () => {
    expect(JSON.parse(generated({ filesystem: stdio, docs: remote }))).toEqual({
      mcpServers: { filesystem: stdio },
    });
  });
});

describe('goose project MCP capability and revocation', () => {
  it('declares project MCP as native', () => {
    expect(descriptor.capabilities.mcp).toBe('native');
  });

  it('lists the plugin .mcp.json as a managed project output so revocation deletes it', async () => {
    const projectRoot = setupFixture({
      [GOOSE_PROJECT_MCP_FILE]: JSON.stringify({ mcpServers: { filesystem: stdio } }),
    });

    const stale = await findStaleGeneratedOutputs({
      projectRoot,
      targets: ['goose'],
      expectedPaths: [],
      scope: 'project',
    });

    expect(stale).toContain(GOOSE_PROJECT_MCP_FILE);
  });

  it('does not manage the plugin .mcp.json at global scope', () => {
    expect(descriptor.globalSupport!.layout.managedOutputs.files).not.toContain(
      GOOSE_PROJECT_MCP_FILE,
    );
  });

  it('detects a goose project whose only surface is the plugin .mcp.json', () => {
    expect(descriptor.detectionPaths).toContain(GOOSE_PROJECT_MCP_FILE);
  });

  it('names the plugin .mcp.json in the empty-import message', () => {
    expect(descriptor.emptyImportMessage).toContain(GOOSE_PROJECT_MCP_FILE);
  });
});

describe('lintMcp (goose, project scope)', () => {
  it('stays silent when every server is stdio', () => {
    expect(lintMcp(makeCanonical({ filesystem: stdio }), { scope: 'project' })).toEqual([]);
  });

  it('names every dropped remote server', () => {
    const diags = lintMcp(makeCanonical({ filesystem: stdio, docs: remote, search: remote }), {
      scope: 'project',
    });
    expect(diags).toHaveLength(1);
    expect(diags[0].level).toBe('warning');
    expect(diags[0].message).toContain('docs, search');
    expect(diags[0].message).not.toContain('filesystem');
  });

  it('stays silent at global scope where config.yaml carries both transports', () => {
    expect(lintMcp(makeCanonical({ docs: remote }), { scope: 'global' })).toEqual([]);
  });

  it('stays silent when there is no canonical MCP config at all', () => {
    expect(lintMcp(makeCanonical(null), { scope: 'project' })).toEqual([]);
    expect(lintMcp(makeCanonical({}), { scope: 'project' })).toEqual([]);
  });

  it('defaults to project scope when no options are supplied', () => {
    expect(lintMcp(makeCanonical({ docs: remote }))).toHaveLength(1);
  });

  // The warning used to end with "Generate with --global to write them to
  // ~/.config/goose/config.yaml instead", pointing at the user's primary goose
  // config. It states the fact now; it does not prescribe a global run.
  it('does not instruct the user to run a global generate', () => {
    const [diag] = lintMcp(makeCanonical({ docs: remote }), { scope: 'project' });
    expect(diag.message).not.toContain('--global');
  });
});

describe('importFromGoose (project MCP)', () => {
  it('round-trips the generated plugin .mcp.json back into canonical mcp.json', async () => {
    const projectRoot = setupFixture({
      [GOOSE_PROJECT_MCP_FILE]: generated({ filesystem: stdio }),
    });

    const results = await importFromGoose(projectRoot);

    expect(results.map((r) => r.toPath)).toEqual(['.agentsmesh/mcp.json']);
    expect(results[0].feature).toBe('mcp');
    expect(results[0].fromTool).toBe('goose');
    const written = JSON.parse(readFileSync(join(projectRoot, '.agentsmesh/mcp.json'), 'utf-8'));
    expect(written).toEqual({ mcpServers: { filesystem: stdio } });
  });

  it('preserves canonical servers goose cannot represent', async () => {
    const projectRoot = setupFixture({
      [GOOSE_PROJECT_MCP_FILE]: generated({ filesystem: stdio }),
      '.agentsmesh/mcp.json': JSON.stringify({ mcpServers: { docs: remote } }, null, 2),
    });

    await importFromGoose(projectRoot);

    const written = JSON.parse(readFileSync(join(projectRoot, '.agentsmesh/mcp.json'), 'utf-8'));
    expect(written).toEqual({ mcpServers: { docs: remote, filesystem: stdio } });
  });

  it('ignores a malformed plugin .mcp.json instead of clobbering canonical', async () => {
    const projectRoot = setupFixture({
      [GOOSE_PROJECT_MCP_FILE]: '{ not json',
      '.agentsmesh/mcp.json': JSON.stringify({ mcpServers: { docs: remote } }, null, 2),
    });

    const results = await importFromGoose(projectRoot);

    expect(results).toEqual([]);
    const written = JSON.parse(readFileSync(join(projectRoot, '.agentsmesh/mcp.json'), 'utf-8'));
    expect(written).toEqual({ mcpServers: { docs: remote } });
  });

  it('skips entries with neither command nor url, which canonical cannot hold', async () => {
    const projectRoot = setupFixture({
      [GOOSE_PROJECT_MCP_FILE]: JSON.stringify({
        mcpServers: { broken: { args: ['x'] }, filesystem: stdio },
      }),
    });

    await importFromGoose(projectRoot);

    const written = JSON.parse(readFileSync(join(projectRoot, '.agentsmesh/mcp.json'), 'utf-8'));
    expect(Object.keys(written.mcpServers)).toEqual(['filesystem']);
  });

  // A user who drops a Claude Code `.mcp.json` into the plugin dir must not lose
  // the remote entries: canonical CAN hold them, so import keeps them and lintMcp
  // is what names them as unusable by goose.
  it('imports remote entries instead of dropping them silently', async () => {
    const projectRoot = setupFixture({
      [GOOSE_PROJECT_MCP_FILE]: JSON.stringify({
        mcpServers: {
          filesystem: stdio,
          docs: { type: 'http', url: 'https://docs.example.com/mcp', headers: { A: 'b' } },
        },
      }),
    });

    await importFromGoose(projectRoot);

    const written = JSON.parse(readFileSync(join(projectRoot, '.agentsmesh/mcp.json'), 'utf-8'));
    expect(written.mcpServers.docs).toEqual({
      type: 'http',
      url: 'https://docs.example.com/mcp',
      headers: { A: 'b' },
      env: {},
    });
  });

  it('defaults a remote entry with no type to http', async () => {
    const projectRoot = setupFixture({
      [GOOSE_PROJECT_MCP_FILE]: JSON.stringify({
        mcpServers: { docs: { url: 'https://docs.example.com/mcp', description: 'Docs' } },
      }),
    });

    await importFromGoose(projectRoot);

    const written = JSON.parse(readFileSync(join(projectRoot, '.agentsmesh/mcp.json'), 'utf-8'));
    expect(written.mcpServers.docs).toEqual({
      type: 'http',
      url: 'https://docs.example.com/mcp',
      headers: {},
      env: {},
      description: 'Docs',
    });
  });

  it('names an imported remote entry in a lint warning rather than dropping it silently', async () => {
    const projectRoot = setupFixture({
      [GOOSE_PROJECT_MCP_FILE]: JSON.stringify({
        mcpServers: { docs: { type: 'http', url: 'https://docs.example.com/mcp' } },
      }),
    });

    await importFromGoose(projectRoot);
    const written = JSON.parse(readFileSync(join(projectRoot, '.agentsmesh/mcp.json'), 'utf-8'));
    const diags = lintMcp(makeCanonical(written.mcpServers), { scope: 'project' });

    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain('docs');
  });

  it('does not read the project plugin file under global scope', async () => {
    const projectRoot = setupFixture({
      [GOOSE_PROJECT_MCP_FILE]: JSON.stringify({ mcpServers: { filesystem: stdio } }),
    });

    const results = await importFromGoose(projectRoot, { scope: 'global' });

    expect(results.filter((r) => r.feature === 'mcp')).toEqual([]);
  });
});
