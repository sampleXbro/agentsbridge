/**
 * Goose project `.mcp.json` must be merged key-scoped, never rewritten whole.
 *
 * `crates/goose/src/plugins/mcp_servers.rs` declares
 * `McpServerConfig { command: String, #[serde(default)] args, env, cwd: Option<String> }`
 * with no `deny_unknown_fields`, and the document struct is
 * `McpServersDocument { #[serde(default, rename = "mcpServers")] .. }`. So:
 *   - `cwd` is a real goose field canonical cannot express -> generate must keep it,
 *   - unknown top-level keys (`$schema`) are ignored by goose -> generate must keep them,
 *   - `command` has NO serde default -> an entry without one fails the whole document,
 *     so the server set stays exactly canonical's stdio set (revocation included).
 */

import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import type { McpServer } from '../../../../src/core/mcp-types.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import { generate } from '../../../../src/core/generate/engine.js';
import { descriptor } from '../../../../src/targets/goose/index.js';
import { importFromGoose } from '../../../../src/targets/goose/importer.js';
import { GOOSE_PROJECT_MCP_FILE } from '../../../../src/targets/goose/constants.js';

const roots: string[] = [];

function setupFixture(files: Record<string, string> = {}): string {
  const root = join(
    tmpdir(),
    `goose-mcp-merge-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

function mcpConfig(features: string[] = ['mcp']): ValidatedConfig {
  return {
    version: 1,
    targets: ['goose'],
    features,
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
  } as ValidatedConfig;
}

const stdio: McpServer = {
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
  env: { API_KEY: 'abc' },
};

const remote: McpServer = {
  type: 'streamable_http',
  url: 'https://mcp.example.com/sse',
  headers: {},
  env: {},
};

const MCP_FEATURES: ReadonlySet<string> = new Set(['mcp']);

function emit(
  canonical: CanonicalFiles,
  scope: 'project' | 'global',
  features = MCP_FEATURES,
): readonly { readonly path: string; readonly content: string }[] {
  return descriptor.emitScopedSettings!(canonical, scope, features);
}

describe('goose emitScopedSettings — project .mcp.json', () => {
  it('emits the plugin .mcp.json with a top-level mcpServers map', () => {
    const out = emit(makeCanonical({ filesystem: stdio }), 'project');
    expect(out).toHaveLength(1);
    expect(out[0].path).toBe(GOOSE_PROJECT_MCP_FILE);
    expect(JSON.parse(out[0].content)).toEqual({ mcpServers: { filesystem: stdio } });
  });

  it('omits remote servers the plugin parser cannot deserialize', () => {
    const out = emit(makeCanonical({ filesystem: stdio, docs: remote }), 'project');
    expect(JSON.parse(out[0].content)).toEqual({ mcpServers: { filesystem: stdio } });
  });

  it('emits nothing when mcp is not an enabled feature', () => {
    expect(emit(makeCanonical({ filesystem: stdio }), 'project', new Set(['rules']))).toEqual([]);
  });

  it('emits nothing at global scope (config.yaml carries those servers)', () => {
    expect(emit(makeCanonical({ filesystem: stdio }), 'global')).toEqual([]);
  });

  it('emits nothing when canonical holds no stdio servers', () => {
    expect(emit(makeCanonical({ docs: remote }), 'project')).toEqual([]);
    expect(emit(makeCanonical({}), 'project')).toEqual([]);
    expect(emit(makeCanonical(null), 'project')).toEqual([]);
  });
});

describe('goose mergeGeneratedOutputContent — project .mcp.json', () => {
  const merge = (
    existing: string | null,
    newContent: string,
    path = GOOSE_PROJECT_MCP_FILE,
  ): string | null =>
    descriptor.mergeGeneratedOutputContent!(existing, undefined, newContent, path);

  const generated = JSON.stringify({ mcpServers: { filesystem: stdio } }, null, 2);

  it('keeps the goose-only cwd key canonical cannot express', () => {
    const existing = JSON.stringify({
      mcpServers: { filesystem: { command: 'npx', args: [], env: {}, cwd: './tools' } },
    });
    const merged = JSON.parse(merge(existing, generated)!) as {
      mcpServers: Record<string, Record<string, unknown>>;
    };
    expect(merged.mcpServers.filesystem.cwd).toBe('./tools');
    expect(merged.mcpServers.filesystem.command).toBe('npx');
    expect(merged.mcpServers.filesystem.args).toEqual(stdio.args);
  });

  it('keeps unknown top-level keys such as $schema', () => {
    const existing = JSON.stringify({ $schema: 'https://x.dev/mcp.json', mcpServers: {} });
    const merged = JSON.parse(merge(existing, generated)!) as Record<string, unknown>;
    expect(merged.$schema).toBe('https://x.dev/mcp.json');
  });

  it('still revokes a server removed from canonical', () => {
    const existing = JSON.stringify({
      mcpServers: { filesystem: { command: 'npx' }, gone: { command: 'old' } },
    });
    const merged = JSON.parse(merge(existing, generated)!) as {
      mcpServers: Record<string, unknown>;
    };
    expect(Object.keys(merged.mcpServers)).toEqual(['filesystem']);
  });

  it('removes a remote entry, which would break goose deserialization of the whole file', () => {
    const existing = JSON.stringify({
      mcpServers: { filesystem: { command: 'npx' }, docs: { type: 'http', url: 'https://x.dev' } },
    });
    const merged = JSON.parse(merge(existing, generated)!) as {
      mcpServers: Record<string, unknown>;
    };
    expect(Object.keys(merged.mcpServers)).toEqual(['filesystem']);
  });

  // Preserved, not replaced: rewriting a file we cannot parse drops every key.
  it('preserves an existing file that is not JSON', () => {
    expect(merge('{ not json', generated)).toBe('{ not json');
  });

  it('preserves an existing file that is a JSON array', () => {
    expect(merge('[]', generated)).toBe('[]');
  });

  it('returns the generated document when there is no existing file', () => {
    expect(merge(null, generated)).toBe(generated);
  });

  it('declines paths it does not own', () => {
    expect(merge('{}', generated, '.goosehints')).toBeNull();
  });

  it('handles an existing file with no mcpServers key', () => {
    const merged = JSON.parse(merge('{"$schema":"x"}', generated)!) as {
      $schema: string;
      mcpServers: Record<string, unknown>;
    };
    expect(merged.$schema).toBe('x');
    expect(Object.keys(merged.mcpServers)).toEqual(['filesystem']);
  });

  it('ignores a non-object entry in the existing mcpServers map', () => {
    const existing = JSON.stringify({ mcpServers: { filesystem: 'not-an-object' } });
    const merged = JSON.parse(merge(existing, generated)!) as {
      mcpServers: Record<string, Record<string, unknown>>;
    };
    expect(merged.mcpServers.filesystem.command).toBe('npx');
  });

  it('prefers a pending result over the on-disk file as merge base', () => {
    const pending = {
      target: 'goose',
      path: GOOSE_PROJECT_MCP_FILE,
      content: JSON.stringify({
        mcpServers: { filesystem: { command: 'npx', cwd: './from-pending' } },
      }),
      status: 'updated' as const,
    };
    const merged = JSON.parse(
      descriptor.mergeGeneratedOutputContent!(
        JSON.stringify({ mcpServers: { filesystem: { command: 'npx', cwd: './from-disk' } } }),
        pending,
        generated,
        GOOSE_PROJECT_MCP_FILE,
      )!,
    ) as { mcpServers: Record<string, Record<string, unknown>> };
    expect(merged.mcpServers.filesystem.cwd).toBe('./from-pending');
  });
});

describe('goose project MCP through the real generate engine', () => {
  it('does not erase cwd from a hand-written plugin .mcp.json', async () => {
    const projectRoot = setupFixture({
      [GOOSE_PROJECT_MCP_FILE]: JSON.stringify(
        {
          $schema: 'https://x.dev/mcp.json',
          mcpServers: { filesystem: { command: 'node', args: ['old.js'], cwd: './tools' } },
        },
        null,
        2,
      ),
    });

    const results = await generate({
      config: mcpConfig(),
      canonical: makeCanonical({ filesystem: stdio }),
      projectRoot,
      scope: 'project',
    });

    const emitted = results.filter((r) => r.path === GOOSE_PROJECT_MCP_FILE);
    expect(emitted).toHaveLength(1);
    const parsed = JSON.parse(emitted[0].content) as {
      $schema: string;
      mcpServers: Record<string, Record<string, unknown>>;
    };
    expect(parsed.$schema).toBe('https://x.dev/mcp.json');
    expect(parsed.mcpServers.filesystem.cwd).toBe('./tools');
    expect(parsed.mcpServers.filesystem.args).toEqual(stdio.args);
  });

  it('survives import -> generate: cwd is still in the file goose reads', async () => {
    const projectRoot = setupFixture({
      [GOOSE_PROJECT_MCP_FILE]: JSON.stringify({
        mcpServers: {
          filesystem: { command: 'npx', args: stdio.args, env: stdio.env, cwd: './tools' },
        },
      }),
    });

    await importFromGoose(projectRoot);
    const results = await generate({
      config: mcpConfig(),
      canonical: makeCanonical({ filesystem: stdio }),
      projectRoot,
      scope: 'project',
    });

    const parsed = JSON.parse(results.find((r) => r.path === GOOSE_PROJECT_MCP_FILE)!.content) as {
      mcpServers: Record<string, Record<string, unknown>>;
    };
    expect(parsed.mcpServers.filesystem.cwd).toBe('./tools');
  });
});
