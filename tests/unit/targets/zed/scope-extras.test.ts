/**
 * The scope-extras revocation pass: `emitScopedSettings` cannot read the disk, so
 * this hook is what clears an owned settings key after the user empties canonical.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { zedScopeExtras } from '../../../../src/targets/zed/scope-extras.js';
import { mergeZedSettings } from '../../../../src/targets/zed/scoped-settings.js';
import {
  ZED_SETTINGS_FILE,
  ZED_GLOBAL_SETTINGS_FILE,
} from '../../../../src/targets/zed/constants.js';

const ALL = new Set(['rules', 'mcp', 'ignore', 'permissions']);

function canonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
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

function parse(content: string): Record<string, unknown> {
  return JSON.parse(content) as Record<string, unknown>;
}

/**
 * The hook emits a revocation PROJECTION (`{ key: null }`), which the engine
 * folds into the file through the shared merge policy. Asserting the projection
 * alone would not prove the key actually goes away, so every revocation case
 * asserts the file the pipeline ends up writing.
 */
function applied(projection: string, onDisk: unknown, path: string): Record<string, unknown> {
  const merged = mergeZedSettings(JSON.stringify(onDisk, null, 2), undefined, projection, path);
  return parse(merged!);
}

describe('zedScopeExtras — revocation pass', () => {
  let root = '';

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'am-zed-extras-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function writeSettings(relPath: string, value: unknown): void {
    mkdirSync(join(root, relPath, '..'), { recursive: true });
    writeFileSync(join(root, relPath), JSON.stringify(value, null, 2));
  }

  it('emits nothing when the settings file does not exist', async () => {
    expect(await zedScopeExtras(canonical(), root, 'project', ALL)).toEqual([]);
  });

  it('emits nothing when no owned key needs to change', async () => {
    writeSettings(ZED_SETTINGS_FILE, { theme: 'One Dark' });
    expect(await zedScopeExtras(canonical(), root, 'project', ALL)).toEqual([]);
  });

  it('clears context_servers the emptied mcp.json no longer produces', async () => {
    writeSettings(ZED_SETTINGS_FILE, {
      theme: 'One Dark',
      context_servers: { stale: { command: 'old' } },
    });

    const results = await zedScopeExtras(
      canonical({ mcp: { mcpServers: {} } }),
      root,
      'project',
      ALL,
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.target).toBe('zed');
    expect(results[0]!.path).toBe(ZED_SETTINGS_FILE);
    expect(parse(results[0]!.content)).toEqual({ context_servers: null });
    expect(
      applied(
        results[0]!.content,
        { theme: 'One Dark', context_servers: { stale: { command: 'old' } } },
        ZED_SETTINGS_FILE,
      ),
    ).toEqual({ theme: 'One Dark' });
  });

  it('leaves hand-written editor settings alone when no canonical source exists', async () => {
    const settings = {
      theme: 'One Dark',
      context_servers: { mine: { command: 'own' } },
      file_scan_exclusions: ['**/target', '...'],
      private_files: ['**/secrets.yml'],
    };
    writeSettings(ZED_SETTINGS_FILE, settings);

    expect(await zedScopeExtras(canonical(), root, 'project', ALL)).toEqual([]);
  });

  it('never removes an exclusion the user wrote, even with an emptied canonical ignore', async () => {
    writeSettings(ZED_SETTINGS_FILE, {
      file_scan_exclusions: ['**/target', '...'],
      private_files: ['**/secrets.yml'],
    });

    expect(await zedScopeExtras(canonical({ ignore: [] }), root, 'project', ALL)).toEqual([]);
  });

  it('clears a revoked grant from the global settings file', async () => {
    writeSettings(ZED_GLOBAL_SETTINGS_FILE, {
      agent: { tool_permissions: { tools: { terminal: { always_allow: [{ pattern: '^rm$' }] } } } },
    });

    const results = await zedScopeExtras(
      canonical({ permissions: { allow: [], deny: [], ask: [] } }),
      root,
      'global',
      ALL,
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe(ZED_GLOBAL_SETTINGS_FILE);
    expect(parse(results[0]!.content)).toEqual({ agent: null });
    expect(
      applied(
        results[0]!.content,
        {
          agent: {
            tool_permissions: { tools: { terminal: { always_allow: [{ pattern: '^rm$' }] } } },
          },
        },
        ZED_GLOBAL_SETTINGS_FILE,
      ),
    ).toEqual({});
  });

  it('keeps a hand-written regex when the grant beside it is revoked', async () => {
    writeSettings(ZED_GLOBAL_SETTINGS_FILE, {
      agent: {
        tool_permissions: {
          tools: { terminal: { always_deny: [{ pattern: '^sudo' }, { pattern: '^rm$' }] } },
        },
      },
    });

    const results = await zedScopeExtras(
      canonical({ permissions: { allow: [], deny: [], ask: [] } }),
      root,
      'global',
      ALL,
    );

    expect(
      applied(
        results[0]!.content,
        {
          agent: {
            tool_permissions: {
              tools: { terminal: { always_deny: [{ pattern: '^sudo' }, { pattern: '^rm$' }] } },
            },
          },
        },
        ZED_GLOBAL_SETTINGS_FILE,
      ),
    ).toEqual({
      agent: {
        tool_permissions: { tools: { terminal: { always_deny: [{ pattern: '^sudo' }] } } },
      },
    });
  });

  it('leaves a stale key alone when its feature is disabled', async () => {
    writeSettings(ZED_SETTINGS_FILE, { context_servers: { stale: { command: 'old' } } });
    expect(
      await zedScopeExtras(
        canonical({ mcp: { mcpServers: {} } }),
        root,
        'project',
        new Set(['rules']),
      ),
    ).toEqual([]);
  });

  it('never rewrites a JSONC settings file, so user comments survive', async () => {
    mkdirSync(join(root, '.zed'), { recursive: true });
    writeFileSync(
      join(root, ZED_SETTINGS_FILE),
      '{\n  // servers\n  "context_servers": { "stale": { "command": "old" } }\n}',
    );
    expect(
      await zedScopeExtras(canonical({ mcp: { mcpServers: {} } }), root, 'project', ALL),
    ).toEqual([]);
  });
});
