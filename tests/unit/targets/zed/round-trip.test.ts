/**
 * generate -> write -> import -> generate must be a fixed point, and the import
 * leg must never delete canonical content Zed cannot represent.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { GenerateResult } from '../../../../src/core/types.js';
import type { ValidatedConfig } from '../../../../src/config/core/schema.js';
import { generate } from '../../../../src/core/generate/engine.js';
import { loadCanonicalFiles } from '../../../../src/canonical/load/loader.js';
import { importFromZed } from '../../../../src/targets/zed/importer.js';
import {
  ZED_GLOBAL_SETTINGS_FILE,
  ZED_GLOBAL_ROOT_FILE,
} from '../../../../src/targets/zed/constants.js';

const FEATURES = ['rules', 'commands', 'skills', 'mcp', 'ignore', 'permissions'];

function config(): ValidatedConfig {
  return {
    version: 1,
    targets: ['zed'],
    features: FEATURES,
    extends: [],
    overrides: {},
    collaboration: { strategy: 'merge', lock_features: [] },
  } as ValidatedConfig;
}

let root = '';

function write(relPath: string, content: string): void {
  mkdirSync(dirname(join(root, relPath)), { recursive: true });
  writeFileSync(join(root, relPath), content);
}

function flush(results: GenerateResult[]): void {
  for (const result of results) write(result.path, result.content);
}

function read(relPath: string): string {
  return readFileSync(join(root, relPath), 'utf8');
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'am-zed-rt-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function seedCanonical(): void {
  write('.agentsmesh/rules/_root.md', '---\nroot: true\n---\n# Root\n\nAlways run the tests.\n');
  write(
    '.agentsmesh/rules/style.md',
    '---\nroot: false\ndescription: Style rules\n---\n# Style\n\nUse tabs, never spaces.\n',
  );
  write('.agentsmesh/commands/review.md', '---\ndescription: Review the diff\n---\nReview it.\n');
  write(
    '.agentsmesh/skills/api-generator/SKILL.md',
    '---\nname: api-generator\n---\nBuild APIs.\n',
  );
  write('.agentsmesh/mcp.json', '{"mcpServers":{"srv":{"command":"npx","args":["-y","x"]}}}');
  write('.agentsmesh/ignore', '# build output\ndist/\n!dist/keep.txt\n*.log\n');
  write(
    '.agentsmesh/permissions.yaml',
    '# hand written\nallow:\n  - Bash(git status:*)\n  - Read(./src/**)\ndeny:\n  - Edit(./.env)\nask:\n  - Bash(git push:*)\n',
  );
}

describe('zed global round-trip', () => {
  it('is a fixed point across generate -> write -> import -> generate', async () => {
    seedCanonical();
    // A settings file the user already owns: agentsmesh must not evict any of it.
    write(
      ZED_GLOBAL_SETTINGS_FILE,
      JSON.stringify(
        {
          theme: 'One Dark',
          agent: {
            default_model: { provider: 'zed.dev' },
            tool_permissions: { tools: { delete_path: { always_deny: [{ pattern: '^/etc$' }] } } },
          },
        },
        null,
        2,
      ),
    );

    const first = await generate({
      config: config(),
      canonical: await loadCanonicalFiles(root),
      projectRoot: root,
      scope: 'global',
    });
    flush(first);

    const settings = JSON.parse(read(ZED_GLOBAL_SETTINGS_FILE)) as Record<string, unknown>;
    expect(settings.theme).toBe('One Dark');
    expect(settings.context_servers).toEqual({
      srv: { type: 'stdio', command: 'npx', args: ['-y', 'x'], env: {} },
    });
    expect(settings.file_scan_exclusions).toEqual(['**/dist', '**/*.log', '...']);
    expect(settings.agent).toEqual({
      default_model: { provider: 'zed.dev' },
      tool_permissions: {
        tools: {
          delete_path: { always_deny: [{ pattern: '^/etc$' }] },
          terminal: {
            always_allow: [{ pattern: '^git status(\\s.*)?$', case_sensitive: true }],
            always_confirm: [{ pattern: '^git push(\\s.*)?$', case_sensitive: true }],
          },
          edit_file: { always_deny: [{ pattern: '^\\./\\.env$', case_sensitive: true }] },
        },
      },
    });

    await importFromZed(root, { scope: 'global' });
    // The embedded non-root rule has to come back as its own canonical file,
    // or the next generate strips the managed block and loses it.
    expect(read('.agentsmesh/rules/style.md')).toContain('Use tabs, never spaces.');

    const second = await generate({
      config: config(),
      canonical: await loadCanonicalFiles(root),
      projectRoot: root,
      scope: 'global',
    });

    expect(second.map((r) => r.path).sort()).toEqual(first.map((r) => r.path).sort());
    for (const result of second) {
      const before = first.find((r) => r.path === result.path)!;
      expect(result.content, result.path).toBe(before.content);
    }
  });

  it('keeps canonical content Zed cannot represent when importing', async () => {
    seedCanonical();
    write(ZED_GLOBAL_ROOT_FILE, '# Root\n\nAlways run the tests.\n');
    write(
      ZED_GLOBAL_SETTINGS_FILE,
      JSON.stringify({
        private_files: ['**/dist'],
        agent: {
          tool_permissions: {
            tools: {
              terminal: { always_allow: [{ pattern: '^ls$' }] },
              // A hand-written Rust regex agentsmesh must not try to own.
              edit_file: { always_deny: [{ pattern: 'secrets?/' }] },
            },
          },
        },
      }),
    );

    await importFromZed(root, { scope: 'global' });

    const ignore = read('.agentsmesh/ignore');
    expect(ignore).toContain('# build output');
    expect(ignore).toContain('!dist/keep.txt');
    expect(ignore).toContain('dist/');
    // This settings.json never listed it, but every other target reads the same
    // canonical file, so import must not treat Zed's silence as a deletion.
    expect(ignore).toContain('*.log');

    const permissions = read('.agentsmesh/permissions.yaml');
    expect(permissions).toContain('# hand written');
    // Zed has no read tool, so the entry stays untouched.
    expect(permissions).toContain('Read(./src/**)');
    expect(permissions).toContain('Bash(ls)');
    // Absent from this file, but canonical is shared — import only ever adds.
    expect(permissions).toContain('Bash(git status:*)');
    // The un-decodable regex was left in settings.json, not forced into canonical.
    expect(permissions).not.toContain('secrets');
  });
});
