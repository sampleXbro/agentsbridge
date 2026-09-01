import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { stringify as yamlStringify } from 'yaml';
import { gooseMcpMap } from '../../../../src/targets/goose/mcp-import.js';
import type { McpServer } from '../../../../src/core/mcp-types.js';
import type { ImportEntryContext } from '../../../../src/targets/catalog/import-descriptor.js';

const roots: string[] = [];

function makeDestDir(): string {
  const root = join(tmpdir(), `goose-mcp-map-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(root, { recursive: true });
  roots.push(root);
  return root;
}

function ctx(content: string, destDir: string): ImportEntryContext {
  return {
    absolutePath: join(destDir, 'config.yaml'),
    relativePath: '.config/goose/config.yaml',
    content,
    destDir,
    normalizeTo: (dest) => dest,
  };
}

function parsedServers(content: string): Record<string, McpServer> {
  return (JSON.parse(content) as { mcpServers: Record<string, McpServer> }).mcpServers;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('gooseMcpMap (goose) — parseExtensions branches', () => {
  it('returns null on invalid YAML content', async () => {
    expect(await gooseMcpMap(ctx('::: not: valid: yaml :::', makeDestDir()))).toBeNull();
  });

  it('returns null when parsed YAML has no extensions key', async () => {
    expect(await gooseMcpMap(ctx(yamlStringify({ other: true }), makeDestDir()))).toBeNull();
  });

  it('returns null when the whole document is a YAML sequence', async () => {
    expect(await gooseMcpMap(ctx(yamlStringify(['a', 'b']), makeDestDir()))).toBeNull();
  });

  it('returns null when the whole document is null', async () => {
    expect(await gooseMcpMap(ctx('null\n', makeDestDir()))).toBeNull();
  });

  it('keeps the description on a remote extension', async () => {
    const content = yamlStringify({
      extensions: { docs: { type: 'sse', uri: 'https://x.dev/sse', description: 'Docs' } },
    });
    const result = await gooseMcpMap(ctx(content, makeDestDir()));
    expect(parsedServers(result!.content).docs).toMatchObject({ description: 'Docs' });
  });

  it('returns null when extensions is a non-object (array)', async () => {
    expect(
      await gooseMcpMap(ctx(yamlStringify({ extensions: ['a', 'b'] }), makeDestDir())),
    ).toBeNull();
  });

  it('skips malformed (non-object) extension values', async () => {
    const content = yamlStringify({
      extensions: { bad: 'not-an-object', good: { type: 'stdio', cmd: 'npx' } },
    });
    const result = await gooseMcpMap(ctx(content, makeDestDir()));
    const servers = parsedServers(result!.content);
    expect(Object.keys(servers)).toEqual(['good']);
  });

  it('skips a stdio extension missing cmd', async () => {
    const content = yamlStringify({
      extensions: { broken: { type: 'stdio' }, ok: { type: 'stdio', cmd: 'node' } },
    });
    const result = await gooseMcpMap(ctx(content, makeDestDir()));
    expect(Object.keys(parsedServers(result!.content))).toEqual(['ok']);
  });

  it('skips a non-stdio extension missing uri (no cmd, no uri)', async () => {
    const content = yamlStringify({
      extensions: { broken: { type: 'sse' }, ok: { type: 'sse', uri: 'https://x.dev' } },
    });
    const result = await gooseMcpMap(ctx(content, makeDestDir()));
    expect(Object.keys(parsedServers(result!.content))).toEqual(['ok']);
  });

  it('maps both a stdio (with description) and an sse (no description) extension', async () => {
    const content = yamlStringify({
      extensions: {
        fs: { type: 'stdio', cmd: 'npx', args: ['-y', 'srv'], envs: { K: 'v' }, description: 'd' },
        remote: { type: 'sse', uri: 'https://x.dev/sse' },
      },
    });
    const result = await gooseMcpMap(ctx(content, makeDestDir()));
    const servers = parsedServers(result!.content);
    expect(servers.fs).toEqual({
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'srv'],
      env: { K: 'v' },
      description: 'd',
    });
    expect(servers.remote).toEqual({
      type: 'sse',
      url: 'https://x.dev/sse',
      headers: {},
      env: {},
    });
  });
});

describe('gooseMcpMap (goose) — parsePluginMcpJson branches', () => {
  function jsonCtx(content: string, destDir: string): ImportEntryContext {
    return {
      absolutePath: join(destDir, '.mcp.json'),
      relativePath: '.agents/plugins/agentsmesh/.mcp.json',
      content,
      destDir,
      normalizeTo: (dest) => dest,
    };
  }

  it('returns null on invalid JSON content', async () => {
    expect(await gooseMcpMap(jsonCtx('{ not json', makeDestDir()))).toBeNull();
  });

  it('returns null when the top-level value is an array', async () => {
    expect(await gooseMcpMap(jsonCtx(JSON.stringify(['a']), makeDestDir()))).toBeNull();
  });

  it('returns null when the top-level value is null', async () => {
    expect(await gooseMcpMap(jsonCtx('null', makeDestDir()))).toBeNull();
  });

  it('returns null when there is no mcpServers key', async () => {
    expect(await gooseMcpMap(jsonCtx(JSON.stringify({ other: 1 }), makeDestDir()))).toBeNull();
  });

  it('returns null when mcpServers is an array', async () => {
    expect(
      await gooseMcpMap(jsonCtx(JSON.stringify({ mcpServers: ['a'] }), makeDestDir())),
    ).toBeNull();
  });

  it('skips non-object entries and entries without a command', async () => {
    const content = JSON.stringify({
      mcpServers: {
        bad: 'nope',
        alsoBad: null,
        noCommand: { args: ['x'] },
        ok: { command: 'node' },
      },
    });
    const result = await gooseMcpMap(jsonCtx(content, makeDestDir()));
    expect(Object.keys(parsedServers(result!.content))).toEqual(['ok']);
  });

  it('defaults type to stdio and normalizes args/env when they are absent', async () => {
    const content = JSON.stringify({ mcpServers: { fs: { command: 'npx' } } });
    const result = await gooseMcpMap(jsonCtx(content, makeDestDir()));
    expect(parsedServers(result!.content).fs).toEqual({
      type: 'stdio',
      command: 'npx',
      args: [],
      env: {},
    });
  });

  it('keeps an explicit type and description', async () => {
    const content = JSON.stringify({
      mcpServers: {
        fs: { type: 'custom', command: 'npx', args: ['-y'], env: { K: 'v' }, description: 'd' },
      },
    });
    const result = await gooseMcpMap(jsonCtx(content, makeDestDir()));
    expect(parsedServers(result!.content).fs).toEqual({
      type: 'custom',
      command: 'npx',
      args: ['-y'],
      env: { K: 'v' },
      description: 'd',
    });
  });
});

describe('gooseMcpMap (goose) — readExistingServers branches', () => {
  function writeExisting(destDir: string, content: string): void {
    writeFileSync(join(destDir, 'mcp.json'), content, 'utf-8');
  }

  const INCOMING = yamlStringify({ extensions: { fs: { type: 'stdio', cmd: 'npx' } } });

  it('merges imported servers with valid existing mcp.json (imported wins on collision)', async () => {
    const destDir = makeDestDir();
    writeExisting(
      destDir,
      JSON.stringify({
        mcpServers: {
          keep: { type: 'stdio', command: 'keep', args: [], env: {} },
          fs: { type: 'stdio', command: 'OLD', args: [], env: {} },
        },
      }),
    );
    const result = await gooseMcpMap(ctx(INCOMING, destDir));
    const servers = parsedServers(result!.content);
    expect(Object.keys(servers).sort()).toEqual(['fs', 'keep']);
    expect(servers.fs.command).toBe('npx');
  });

  it('treats invalid existing JSON as no existing servers', async () => {
    const destDir = makeDestDir();
    writeExisting(destDir, '{not valid');
    const result = await gooseMcpMap(ctx(INCOMING, destDir));
    expect(Object.keys(parsedServers(result!.content))).toEqual(['fs']);
  });

  it('treats existing JSON array as no existing servers', async () => {
    const destDir = makeDestDir();
    writeExisting(destDir, JSON.stringify(['a', 'b']));
    const result = await gooseMcpMap(ctx(INCOMING, destDir));
    expect(Object.keys(parsedServers(result!.content))).toEqual(['fs']);
  });

  it('treats existing JSON without mcpServers object as no existing servers', async () => {
    const destDir = makeDestDir();
    writeExisting(destDir, JSON.stringify({ mcpServers: 'not-an-object' }));
    const result = await gooseMcpMap(ctx(INCOMING, destDir));
    expect(Object.keys(parsedServers(result!.content))).toEqual(['fs']);
  });

  it('skips non-object entries inside existing mcpServers', async () => {
    const destDir = makeDestDir();
    writeExisting(
      destDir,
      JSON.stringify({
        mcpServers: { bad: 'nope', keep: { type: 'stdio', command: 'keep', args: [], env: {} } },
      }),
    );
    const result = await gooseMcpMap(ctx(INCOMING, destDir));
    expect(Object.keys(parsedServers(result!.content)).sort()).toEqual(['fs', 'keep']);
  });

  it('returns just imported servers when no existing mcp.json present', async () => {
    const result = await gooseMcpMap(ctx(INCOMING, makeDestDir()));
    expect(Object.keys(parsedServers(result!.content))).toEqual(['fs']);
  });
});
