/**
 * Regressions in the shared merge policy where a merger that cannot understand
 * the user's file must not fall through to whole-file replacement.
 *
 * Every case here destroyed real user data before the fix:
 *  - a JSONC base (comments are legal in .vscode/mcp.json and .qwen/settings.json)
 *    made the key-scoped merge bail out, and the fallback replaced the file;
 *  - a TOML table whose quoted key contains a bracket was not recognised as a
 *    table header, so it stayed inside the dropped `[mcp_servers.*]` region;
 *  - two targets writing the same `.mcp.json` disagreed once only one of them
 *    merged, which hard-fails the whole run in `resolveOutputCollisions`.
 */
import { describe, it, expect } from 'vitest';
import { mergeOwnedJsonKeys } from '../../../../src/core/generate/json-owned-keys.js';
import { mergeCodexConfigToml } from '../../../../src/targets/codex-cli/config-merge.js';
import { getBuiltinTargetDefinition } from '../../../../src/targets/catalog/builtin-targets.js';

const GEN_MCP = JSON.stringify({ mcpServers: { ctx: { command: 'npx' } } }, null, 2);

describe('mergeOwnedJsonKeys — a base it cannot parse is preserved, never replaced', () => {
  it('keeps a JSONC base verbatim instead of dropping the user comments and keys', () => {
    const base = [
      '{',
      '  // my token prompt',
      '  "inputs": [{ "id": "tok" }],',
      '  "servers": {}',
      '}',
    ].join('\n');
    const merged = mergeOwnedJsonKeys(base, JSON.stringify({ servers: { ctx: {} } }), ['servers']);
    expect(merged).toBe(base);
  });

  it('keeps a base that is a JSON array verbatim', () => {
    const base = '[1, 2, 3]';
    expect(mergeOwnedJsonKeys(base, GEN_MCP, ['mcpServers'])).toBe(base);
  });

  it('still returns null when there is no base at all, so the generated file is created', () => {
    expect(mergeOwnedJsonKeys(null, GEN_MCP, ['mcpServers'])).toBeNull();
  });

  it('still replaces only the owned key on a well-formed base', () => {
    const base = JSON.stringify({ mcpServers: { old: { command: 'x' } }, userKey: 1 });
    const merged = mergeOwnedJsonKeys(base, GEN_MCP, ['mcpServers']);
    expect(JSON.parse(merged as string)).toEqual({
      mcpServers: { ctx: { command: 'npx' } },
      userKey: 1,
    });
  });
});

describe('mergeCodexConfigToml — quoted table keys containing brackets', () => {
  const gen = '[mcp_servers.ctx]\ncommand = "npx"\n';

  it('keeps a projects trust table whose path contains brackets', () => {
    const base = [
      '[mcp_servers.old]',
      'command = "x"',
      '',
      '[projects."/Users/me/[wo]rk"]',
      'trust_level = "trusted"',
    ].join('\n');
    const merged = mergeCodexConfigToml(base, undefined, gen, '.codex/config.toml');
    expect(merged).toContain('[projects."/Users/me/[wo]rk"]');
    expect(merged).toContain('trust_level = "trusted"');
    expect(merged).toContain('[mcp_servers.ctx]');
    expect(merged).not.toContain('mcp_servers.old');
  });

  it('keeps an array-of-tables header that follows an mcp table', () => {
    const base = ['[mcp_servers.old]', 'command = "x"', '', '[[profiles]]', 'name = "a"'].join(
      '\n',
    );
    const merged = mergeCodexConfigToml(base, undefined, gen, '.codex/config.toml');
    expect(merged).toContain('[[profiles]]');
    expect(merged).toContain('name = "a"');
  });

  it('still drops every generated-owned mcp table', () => {
    const base = ['[mcp_servers.a]', 'command = "1"', '[mcp_servers.b]', 'command = "2"'].join(
      '\n',
    );
    const merged = mergeCodexConfigToml(base, undefined, gen, '.codex/config.toml');
    expect(merged).toBe(gen);
  });
});

describe('.mcp.json is written by two targets — both must merge identically', () => {
  it('claude-code and deepagents-cli agree on a base carrying an extra top-level key', () => {
    const base = JSON.stringify({ mcpServers: { old: { command: 'x' } }, inputs: [{ id: 'tok' }] });
    const claude = getBuiltinTargetDefinition('claude-code');
    const deep = getBuiltinTargetDefinition('deepagents-cli');

    const a = claude?.mergeGeneratedOutputContent?.(base, undefined, GEN_MCP, '.mcp.json');
    const b = deep?.mergeGeneratedOutputContent?.(base, undefined, GEN_MCP, '.mcp.json');

    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(b).toBe(a);
    expect(JSON.parse(a as string)).toEqual({
      mcpServers: { ctx: { command: 'npx' } },
      inputs: [{ id: 'tok' }],
    });
  });
});
