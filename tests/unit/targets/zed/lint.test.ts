/**
 * Two lint contracts that keep the target honest about what it actually does:
 *   - a `settings.json` with comments is left completely alone, so the user has
 *     to be told their MCP servers / exclusions / grants were not written;
 *   - the command projection is conditional on the commands->skills conversion,
 *     so the warning must not promise a projection that may not happen.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { lintRules } from '../../../../src/targets/zed/linter.js';
import { lintCommands } from '../../../../src/targets/zed/lint.js';
import {
  ZED_SETTINGS_FILE,
  ZED_GLOBAL_SETTINGS_FILE,
} from '../../../../src/targets/zed/constants.js';

let root = '';

function write(relPath: string, content: string): void {
  mkdirSync(dirname(join(root, relPath)), { recursive: true });
  writeFileSync(join(root, relPath), content);
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

const JSONC = '{\n  // my theme\n  "theme": "One Dark"\n}';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'am-zed-lint-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('lintRules — settings.json writability', () => {
  it('warns that a commented settings file blocks every settings-backed feature', () => {
    write(ZED_SETTINGS_FILE, JSONC);

    const diags = lintRules(canonical({ ignore: ['dist/'] }), root, [], { scope: 'project' });

    expect(diags).toHaveLength(1);
    expect(diags[0]!.level).toBe('warning');
    expect(diags[0]!.target).toBe('zed');
    expect(diags[0]!.file).toBe(ZED_SETTINGS_FILE);
    expect(diags[0]!.message).toContain('comments');
  });

  it('checks the global settings file in global scope', () => {
    write(ZED_GLOBAL_SETTINGS_FILE, JSONC);

    const diags = lintRules(
      canonical({ mcp: { mcpServers: { srv: { type: 'stdio', command: 'npx' } } } }),
      root,
      [],
      { scope: 'global' },
    );

    expect(diags).toHaveLength(1);
    expect(diags[0]!.file).toBe(ZED_GLOBAL_SETTINGS_FILE);
  });

  it('stays quiet when there is nothing agentsmesh would have written', () => {
    write(ZED_SETTINGS_FILE, JSONC);
    expect(lintRules(canonical(), root, [], { scope: 'project' })).toEqual([]);
  });

  it('stays quiet when the settings file is strict JSON or absent', () => {
    expect(lintRules(canonical({ ignore: ['dist/'] }), root, [], { scope: 'project' })).toEqual([]);
    write(ZED_SETTINGS_FILE, '{"theme":"One Dark"}');
    expect(lintRules(canonical({ ignore: ['dist/'] }), root, [], { scope: 'project' })).toEqual([]);
  });
});

describe('lintCommands', () => {
  it('does not promise a projection the conversion setting can switch off', () => {
    const diags = lintCommands(
      canonical({ commands: [{ name: 'review', body: 'Review it.' }] as never }),
      { scope: 'project' },
    );

    expect(diags).toHaveLength(1);
    expect(diags[0]!.message).toContain('commands_to_skills');
    expect(diags[0]!.message).toContain('disable-model-invocation');
  });

  it('returns [] when there are no commands', () => {
    expect(lintCommands(canonical())).toEqual([]);
  });
});
