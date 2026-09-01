/**
 * `~/.config/goose/config.yaml` is goose's PRIMARY config (provider, model,
 * `GOOSE_MODE`, CLI theme, plus the `extensions` block). agentsmesh owns the
 * `extensions` key and nothing else, so:
 *   - it must never be listed in `managedOutputs.files` (stale-cleanup deletes
 *     every managed file a run did not emit — a global run without `mcp` would
 *     erase the user's whole goose config),
 *   - it must never be rewritten whole,
 *   - goose's own builtin extensions (`type: builtin`) have no canonical
 *     representation — the importer cannot read them back — so generate keeps
 *     them; extensions the importer CAN represent are agentsmesh's inventory
 *     and are rewritten and revoked from canonical.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
import type { CanonicalFiles, GenerateResult } from '../../../../src/core/types.js';
import type { McpServer } from '../../../../src/core/mcp-types.js';
import { descriptor } from '../../../../src/targets/goose/index.js';
import { GOOSE_GLOBAL_CONFIG } from '../../../../src/targets/goose/constants.js';

const roots: string[] = [];

function setupFixture(files: Record<string, string> = {}): string {
  const root = join(
    tmpdir(),
    `goose-global-mcp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(root, { recursive: true });
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

const stdio: McpServer = { type: 'stdio', command: 'npx', args: ['-y', 'srv'], env: {} };
const remote: McpServer = {
  type: 'sse',
  url: 'https://mcp.example.com/sse',
  headers: {},
  env: {},
};

const USER_CONFIG = yamlStringify({
  GOOSE_PROVIDER: 'anthropic',
  GOOSE_MODEL: 'claude-opus-4',
  GOOSE_MODE: 'smart_approve',
  extensions: {
    developer: {
      bundled: true,
      display_name: 'Developer',
      enabled: true,
      name: 'developer',
      timeout: 300,
      type: 'builtin',
    },
    legacy: {
      bundled: null,
      cmd: 'old-server',
      enabled: true,
      envs: {},
      name: 'legacy',
      timeout: 30,
      type: 'stdio',
    },
  },
});

const MCP = new Set(['mcp']);

function extras(
  canonical: CanonicalFiles,
  root: string,
  scope: 'project' | 'global',
  features = MCP,
): Promise<GenerateResult[]> {
  return descriptor.globalSupport!.scopeExtras!(canonical, root, scope, features);
}

function extensionsOf(content: string): Record<string, Record<string, unknown>> {
  return (yamlParse(content) as { extensions: Record<string, Record<string, unknown>> }).extensions;
}

describe('goose global config.yaml is not a managed output', () => {
  it('is absent from globalSupport managedOutputs.files', () => {
    expect(descriptor.globalSupport!.layout.managedOutputs.files).not.toContain(
      GOOSE_GLOBAL_CONFIG,
    );
  });
});

describe('goose global MCP extensions merge', () => {
  it('rewrites only the extensions key and keeps every other setting', async () => {
    const root = setupFixture({ [GOOSE_GLOBAL_CONFIG]: USER_CONFIG });

    const results = await extras(makeCanonical({ search: stdio }), root, 'global');

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(GOOSE_GLOBAL_CONFIG);
    const parsed = yamlParse(results[0].content) as Record<string, unknown>;
    expect(parsed.GOOSE_PROVIDER).toBe('anthropic');
    expect(parsed.GOOSE_MODEL).toBe('claude-opus-4');
    expect(parsed.GOOSE_MODE).toBe('smart_approve');
  });

  it('keeps goose builtin extensions the importer cannot represent', async () => {
    const root = setupFixture({ [GOOSE_GLOBAL_CONFIG]: USER_CONFIG });

    const results = await extras(makeCanonical({ search: stdio }), root, 'global');

    const ext = extensionsOf(results[0].content);
    expect(Object.keys(ext).sort()).toEqual(['developer', 'search']);
    expect(ext.developer.type).toBe('builtin');
  });

  it('revokes an agentsmesh-representable extension dropped from canonical', async () => {
    const root = setupFixture({ [GOOSE_GLOBAL_CONFIG]: USER_CONFIG });

    const results = await extras(makeCanonical({}), root, 'global');

    expect(Object.keys(extensionsOf(results[0].content))).toEqual(['developer']);
  });

  it('carries remote servers, which the project plugin file cannot hold', async () => {
    const root = setupFixture({ [GOOSE_GLOBAL_CONFIG]: USER_CONFIG });

    const results = await extras(makeCanonical({ docs: remote }), root, 'global');

    const ext = extensionsOf(results[0].content);
    expect(ext.docs.uri).toBe('https://mcp.example.com/sse');
    expect(ext.docs.type).toBe('sse');
  });

  it('creates the file when it is missing and canonical has servers', async () => {
    const root = setupFixture();

    const results = await extras(makeCanonical({ search: stdio }), root, 'global');

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('created');
    expect(Object.keys(extensionsOf(results[0].content))).toEqual(['search']);
  });

  it('does not create goose primary config just to write an empty extensions block', async () => {
    const root = setupFixture();

    expect(await extras(makeCanonical({}), root, 'global')).toEqual([]);
  });

  it('leaves the file alone when there is no canonical mcp.json at all', async () => {
    const root = setupFixture({ [GOOSE_GLOBAL_CONFIG]: USER_CONFIG });

    expect(await extras(makeCanonical(null), root, 'global')).toEqual([]);
  });

  it('emits nothing when mcp is not an enabled feature', async () => {
    const root = setupFixture({ [GOOSE_GLOBAL_CONFIG]: USER_CONFIG });

    expect(
      await extras(makeCanonical({ search: stdio }), root, 'global', new Set(['rules'])),
    ).toEqual([]);
  });

  it('emits nothing at project scope', async () => {
    const root = setupFixture({ [GOOSE_GLOBAL_CONFIG]: USER_CONFIG });

    expect(await extras(makeCanonical({ search: stdio }), root, 'project')).toEqual([]);
  });

  it('leaves an unparseable config.yaml untouched rather than replacing it', async () => {
    const root = setupFixture({ [GOOSE_GLOBAL_CONFIG]: 'GOOSE_PROVIDER: [unclosed\n  : :' });

    expect(await extras(makeCanonical({ search: stdio }), root, 'global')).toEqual([]);
  });

  it('leaves a non-mapping config.yaml untouched', async () => {
    const root = setupFixture({ [GOOSE_GLOBAL_CONFIG]: yamlStringify(['a', 'b']) });

    expect(await extras(makeCanonical({ search: stdio }), root, 'global')).toEqual([]);
  });

  it('emits nothing when the merged document equals what is already on disk', async () => {
    const root = setupFixture({ [GOOSE_GLOBAL_CONFIG]: USER_CONFIG });
    const first = await extras(makeCanonical({ search: stdio }), root, 'global');
    writeFileSync(join(root, GOOSE_GLOBAL_CONFIG), first[0].content, 'utf-8');

    expect(await extras(makeCanonical({ search: stdio }), root, 'global')).toEqual([]);
  });

  it('ignores a non-mapping extensions block and rewrites it from canonical', async () => {
    const root = setupFixture({
      [GOOSE_GLOBAL_CONFIG]: yamlStringify({ GOOSE_PROVIDER: 'anthropic', extensions: ['a'] }),
    });

    const results = await extras(makeCanonical({ search: stdio }), root, 'global');

    expect(Object.keys(extensionsOf(results[0].content))).toEqual(['search']);
    expect((yamlParse(results[0].content) as Record<string, unknown>).GOOSE_PROVIDER).toBe(
      'anthropic',
    );
  });

  it('does not add an empty extensions key to a config that never had one', async () => {
    const root = setupFixture({
      [GOOSE_GLOBAL_CONFIG]: yamlStringify({ GOOSE_PROVIDER: 'anthropic' }),
    });

    expect(await extras(makeCanonical({}), root, 'global')).toEqual([]);
  });

  it('carries a server description into the extension entry', async () => {
    const root = setupFixture({ [GOOSE_GLOBAL_CONFIG]: USER_CONFIG });

    const results = await extras(
      makeCanonical({ docs: { ...remote, description: 'Docs server' } }),
      root,
      'global',
    );

    expect(extensionsOf(results[0].content).docs.description).toBe('Docs server');
  });

  it('skips a non-object extension entry when deciding what to keep', async () => {
    const root = setupFixture({
      [GOOSE_GLOBAL_CONFIG]: yamlStringify({ extensions: { junk: 'not-an-object' } }),
    });

    const results = await extras(makeCanonical({ search: stdio }), root, 'global');

    expect(Object.keys(extensionsOf(results[0].content))).toEqual(['search']);
  });
});
