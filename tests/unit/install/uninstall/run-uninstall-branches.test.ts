/**
 * Branch coverage for src/install/uninstall/run-uninstall.ts:
 * - Missing install name validation (line 97).
 * - Non-TTY without --force/--dry-run validation (line 102).
 * - Abort short-circuit returns exitCode 130 (line 132-138).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stringify as stringifyYaml } from 'yaml';
import { runUninstall } from '../../../../src/install/uninstall/run-uninstall.js';
import { hashPackFiles } from '../../../../src/install/manifest/install-manifest-hash.js';
import { INSTALL_MANIFEST_FILENAME } from '../../../../src/install/manifest/install-manifest-hash.js';
import type { PromptAdapter } from '../../../../src/install/prompts/prompt-types.js';

let projectRoot = '';

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'am-uninst-branch-'));
  mkdirSync(join(projectRoot, '.agentsmesh'), { recursive: true });
  writeFileSync(
    join(projectRoot, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code]\nfeatures: [rules]\nextends: []\n',
  );
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('runUninstall — branch coverage', () => {
  it('returns exitCode 1 when no name passed and --all not used', async () => {
    const result = await runUninstall({}, [], projectRoot, { assumeTty: true });
    expect(result.exitCode).toBe(1);
    expect(result.data.removed).toEqual([]);
  });

  it('returns exitCode 1 in non-TTY without --force or --dry-run', async () => {
    const result = await runUninstall({}, ['pack-a'], projectRoot, { assumeTty: false });
    expect(result.exitCode).toBe(1);
  });

  it('passes the non-TTY guard when --force is set', async () => {
    // Set up an empty installs.yaml so plan succeeds with "not found" skipped entry.
    writeFileSync(
      join(projectRoot, '.agentsmesh', 'installs.yaml'),
      stringifyYaml({ version: 1, installs: [] }),
    );
    const result = await runUninstall({ force: true }, ['ghost'], projectRoot, {
      assumeTty: false,
    });
    expect(result.exitCode).toBe(0);
    expect(result.data.removed).toEqual([]);
  });

  it('exits 130 when prompt adapter aborts at the modification confirmation', async () => {
    const packsDir = join(projectRoot, '.agentsmesh', 'packs', 'mod-pack');
    mkdirSync(packsDir, { recursive: true });
    writeFileSync(join(packsDir, 'rules.md'), '# original\n');
    const files = await hashPackFiles(packsDir);
    writeFileSync(join(packsDir, INSTALL_MANIFEST_FILENAME), JSON.stringify({ files }));
    // Modify file → triggers prompt.
    writeFileSync(join(packsDir, 'rules.md'), '# changed\n');
    writeFileSync(
      join(projectRoot, '.agentsmesh', 'installs.yaml'),
      stringifyYaml({
        version: 1,
        installs: [
          {
            name: 'mod-pack',
            source: 'github:acme/mod-pack',
            source_kind: 'github',
            features: ['rules'],
          },
        ],
      }),
    );

    const adapter: PromptAdapter = {
      ask: async () => 'a',
      write: () => {},
    };
    const result = await runUninstall({}, ['mod-pack'], projectRoot, {
      assumeTty: true,
      promptAdapter: adapter,
    });
    expect(result.exitCode).toBe(130);
    expect(result.data.removed).toEqual([]);
  });
});
