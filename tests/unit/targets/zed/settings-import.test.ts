/**
 * Import is ADDITIVE for `.agentsmesh/ignore` and `.agentsmesh/permissions.yaml`.
 *
 * Both files are shared by every target. A Zed `settings.json` is the user's
 * editor config and is routinely only partly populated (one exclusion, one
 * hand-configured tool), so treating it as authoritative for the whole canonical
 * file deletes entries that belong to claude-code, cursor and the rest.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ImportResult } from '../../../../src/core/types.js';
import { importZedSettingsFeatures } from '../../../../src/targets/zed/settings-import.js';
import {
  ZED_SETTINGS_FILE,
  ZED_GLOBAL_SETTINGS_FILE,
} from '../../../../src/targets/zed/constants.js';

let root = '';

function write(relPath: string, content: string): void {
  mkdirSync(dirname(join(root, relPath)), { recursive: true });
  writeFileSync(join(root, relPath), content);
}

function read(relPath: string): string {
  return readFileSync(join(root, relPath), 'utf8');
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'am-zed-import-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('importZedSettingsFeatures — ignore', () => {
  it('keeps every canonical entry Zed does not currently list', async () => {
    write(ZED_SETTINGS_FILE, JSON.stringify({ file_scan_exclusions: ['**/target'] }));
    write(
      '.agentsmesh/ignore',
      '# secrets and build junk\n.env.local\nsecrets/\nnode_modules/\n!secrets/README.md\n',
    );

    const results: ImportResult[] = [];
    await importZedSettingsFeatures(root, ZED_SETTINGS_FILE, 'project', results);

    expect(read('.agentsmesh/ignore')).toBe(
      '# secrets and build junk\n.env.local\nsecrets/\nnode_modules/\n!secrets/README.md\ntarget\n',
    );
    expect(results.map((r) => r.feature)).toEqual(['ignore']);
  });

  it('does not duplicate a canonical line whose glob Zed already excludes', async () => {
    write(ZED_SETTINGS_FILE, JSON.stringify({ private_files: ['**/dist', '**/*.log'] }));
    write('.agentsmesh/ignore', 'dist/\n');

    await importZedSettingsFeatures(root, ZED_SETTINGS_FILE, 'project', []);

    expect(read('.agentsmesh/ignore')).toBe('dist/\n*.log\n');
  });
});

describe('importZedSettingsFeatures — permissions', () => {
  it('keeps canonical entries for tools this settings file never configures', async () => {
    write(
      ZED_GLOBAL_SETTINGS_FILE,
      JSON.stringify({
        agent: {
          tool_permissions: { tools: { terminal: { always_allow: [{ pattern: '^ls$' }] } } },
        },
      }),
    );
    write(
      '.agentsmesh/permissions.yaml',
      '# hand written\nallow: []\ndeny:\n  - Edit(./.env)\n  - Write(/etc/**)\nask:\n  - Bash(git push:*)\n',
    );

    const results: ImportResult[] = [];
    await importZedSettingsFeatures(root, ZED_GLOBAL_SETTINGS_FILE, 'global', results);

    const yaml = read('.agentsmesh/permissions.yaml');
    expect(yaml).toContain('# hand written');
    expect(yaml).toContain('Bash(ls)');
    expect(yaml).toContain('Edit(./.env)');
    expect(yaml).toContain('Write(/etc/**)');
    expect(yaml).toContain('Bash(git push:*)');
    expect(results.map((r) => r.feature)).toEqual(['permissions']);
  });

  it('never reads permissions at project scope, where Zed discards the agent key', async () => {
    write(
      ZED_SETTINGS_FILE,
      JSON.stringify({
        agent: {
          tool_permissions: { tools: { terminal: { always_allow: [{ pattern: '^ls$' }] } } },
        },
      }),
    );

    const results: ImportResult[] = [];
    await importZedSettingsFeatures(root, ZED_SETTINGS_FILE, 'project', results);

    expect(results).toEqual([]);
  });

  it('leaves a JSONC settings file alone instead of half-reading it', async () => {
    write(ZED_SETTINGS_FILE, '{\n  // exclusions\n  "private_files": ["**/dist"]\n}');
    write('.agentsmesh/ignore', 'node_modules/\n');

    const results: ImportResult[] = [];
    await importZedSettingsFeatures(root, ZED_SETTINGS_FILE, 'project', results);

    expect(results).toEqual([]);
    expect(read('.agentsmesh/ignore')).toBe('node_modules/\n');
  });
});
