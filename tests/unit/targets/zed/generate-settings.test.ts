/**
 * Project scope through the real generate engine: mcp and ignore share
 * `.zed/settings.json`, permissions must stay out of it, and the user's own
 * editor settings must survive both the write and the stale-cleanup pass.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import { generate } from '../../../../src/core/generate/engine.js';
import { findStaleGeneratedOutputs } from '../../../../src/core/generate/stale-cleanup.js';
import {
  ZED_SETTINGS_FILE,
  ZED_GLOBAL_SETTINGS_FILE,
} from '../../../../src/targets/zed/constants.js';

function config(): ValidatedConfig {
  return {
    version: 1,
    targets: ['zed'],
    features: ['rules', 'mcp', 'ignore', 'permissions'],
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
  } as ValidatedConfig;
}

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

let root = '';

function write(relPath: string, content: string): void {
  mkdirSync(dirname(join(root, relPath)), { recursive: true });
  writeFileSync(join(root, relPath), content);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'am-zed-gen-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('zed project settings.json', () => {
  it('carries mcp and ignore together while keeping the user keys', async () => {
    write(ZED_SETTINGS_FILE, '{\n  "theme": "One Dark",\n  "tab_size": 2\n}');

    const results = await generate({
      config: config(),
      canonical: canonical({
        mcp: { mcpServers: { srv: { type: 'stdio', command: 'npx' } } },
        ignore: ['dist/', '.env'],
        permissions: { allow: ['Bash(ls)'], deny: [], ask: [] },
      }),
      projectRoot: root,
      scope: 'project',
    });

    const settings = results.filter((r) => r.path === ZED_SETTINGS_FILE);
    expect(settings).toHaveLength(1);
    const json = JSON.parse(settings[0]!.content) as Record<string, unknown>;
    expect(json).toEqual({
      theme: 'One Dark',
      tab_size: 2,
      context_servers: { srv: { type: 'stdio', command: 'npx' } },
      file_scan_exclusions: ['**/dist', '**/.env', '...'],
      private_files: ['**/dist', '**/.env'],
    });
    // agent.tool_permissions is discarded by ProjectSettingsContent.
    expect(json).not.toHaveProperty('agent');
  });

  it('never lists the user settings file as a stale output to delete', async () => {
    write(ZED_SETTINGS_FILE, '{ "theme": "One Dark" }');
    write('.rules', '# Root');

    const stale = await findStaleGeneratedOutputs({
      projectRoot: root,
      targets: ['zed'],
      expectedPaths: ['.rules'],
      scope: 'project',
    });

    expect(stale).toEqual([]);
  });
});

describe('zed global settings.json', () => {
  const handWritten = {
    theme: 'One Dark',
    context_servers: { mine: { command: 'own' } },
    file_scan_exclusions: ['**/target', '...'],
    private_files: ['**/secrets.yml'],
    agent: {
      tool_permissions: {
        tools: {
          terminal: {
            always_allow: [{ pattern: '^cargo\\s+(build|test)$' }],
            always_deny: [{ pattern: '^sudo' }],
          },
          edit_file: { always_deny: [{ pattern: 'secrets?/' }] },
        },
      },
    },
  };

  async function generateGlobal(
    canonicalFiles: CanonicalFiles,
  ): Promise<Record<string, unknown> | undefined> {
    write(ZED_GLOBAL_SETTINGS_FILE, JSON.stringify(handWritten, null, 2));
    const results = await generate({
      config: config(),
      canonical: canonicalFiles,
      projectRoot: root,
      scope: 'global',
    });
    const settings = results.filter((r) => r.path === ZED_GLOBAL_SETTINGS_FILE);
    expect(settings.length).toBeLessThanOrEqual(1);
    return settings[0] ? (JSON.parse(settings[0].content) as Record<string, unknown>) : undefined;
  }

  it('keeps every hand-written rule while writing the canonical grant', async () => {
    const json = await generateGlobal(
      canonical({ permissions: { allow: ['Bash(git status:*)'], deny: [], ask: [] } }),
    );

    expect(json).toEqual({
      ...handWritten,
      agent: {
        tool_permissions: {
          tools: {
            terminal: {
              always_allow: [
                { pattern: '^git status(\\s.*)?$', case_sensitive: true },
                { pattern: '^cargo\\s+(build|test)$' },
              ],
              always_deny: [{ pattern: '^sudo' }],
            },
            edit_file: { always_deny: [{ pattern: 'secrets?/' }] },
          },
        },
      },
    });
  });

  it('writes nothing at all when no canonical source file exists', async () => {
    expect(await generateGlobal(canonical())).toBeUndefined();
  });
});
