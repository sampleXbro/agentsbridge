/**
 * Branch coverage tests for copilot/hook-parser.ts.
 * Targets:
 *   - extractMatcher fallback when regex group is empty.
 *   - extractWrapperCommand: explicit metadata blank, content-only fallback path.
 *   - importHooks: parsed.hooks not an object, entry not an object, missing bash field,
 *     bash references missing script, unsupported event in JSON, legacy file naming
 *     mismatch, legacy file in nested dir.
 */

import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import {
  extractMatcher,
  extractWrapperCommand,
  importHooks,
} from '../../../../src/targets/copilot/hook-parser.js';
import {
  COPILOT_HOOKS_DIR,
  COPILOT_LEGACY_HOOKS_DIR,
} from '../../../../src/targets/copilot/constants.js';
import type { ImportResult } from '../../../../src/core/types.js';

describe('hook-parser helpers — branch coverage', () => {
  it('falls back to "*" when comment matches but captured group is empty/whitespace', () => {
    expect(extractMatcher('Matcher:    ')).toBe('*');
  });

  it('falls back to "*" when comment is null/undefined (non-string)', () => {
    expect(extractMatcher(undefined)).toBe('*');
    expect(extractMatcher(null)).toBe('*');
  });

  it('returns whole content trimmed when no shebang or boilerplate exists', () => {
    expect(extractWrapperCommand('pnpm test')).toBe('pnpm test');
  });

  it('returns empty string when content is only shebang and boilerplate', () => {
    expect(extractWrapperCommand('#!/bin/sh\n# comment\nset -e\n')).toBe('');
  });
});

describe('importHooks — branch coverage', () => {
  let projectRoot = '';

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'amesh-cov-'));
  });

  afterEach(() => {
    if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
    projectRoot = '';
  });

  async function runImport(): Promise<ImportResult[]> {
    const results: ImportResult[] = [];
    await importHooks(projectRoot, results);
    return results;
  }

  it('skips JSON files where parsed.hooks is null', async () => {
    const hooksDir = join(projectRoot, COPILOT_HOOKS_DIR);
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(join(hooksDir, 'h1.json'), JSON.stringify({ hooks: null }));
    expect(await runImport()).toEqual([]);
  });

  it('skips JSON files where parsed.hooks is not an object (string)', async () => {
    const hooksDir = join(projectRoot, COPILOT_HOOKS_DIR);
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(join(hooksDir, 'h2.json'), JSON.stringify({ hooks: 'oops' }));
    expect(await runImport()).toEqual([]);
  });

  it('skips entries that are not objects (string entry)', async () => {
    const hooksDir = join(projectRoot, COPILOT_HOOKS_DIR);
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(
      join(hooksDir, 'h3.json'),
      JSON.stringify({ hooks: { preToolUse: ['oops', null] } }),
    );
    expect(await runImport()).toEqual([]);
  });

  it('skips JSON entries with empty bash path', async () => {
    const hooksDir = join(projectRoot, COPILOT_HOOKS_DIR);
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(
      join(hooksDir, 'h4.json'),
      JSON.stringify({
        hooks: {
          preToolUse: [
            { bash: '' },
            { bash: 42 },
            {
              /* no bash */
            },
          ],
        },
      }),
    );
    expect(await runImport()).toEqual([]);
  });

  it('skips JSON entries whose bash script file is missing', async () => {
    const hooksDir = join(projectRoot, COPILOT_HOOKS_DIR);
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(
      join(hooksDir, 'h5.json'),
      JSON.stringify({ hooks: { preToolUse: [{ bash: './missing.sh' }] } }),
    );
    expect(await runImport()).toEqual([]);
  });

  it('skips JSON entries whose extracted command is empty', async () => {
    const hooksDir = join(projectRoot, COPILOT_HOOKS_DIR);
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(join(hooksDir, 'empty.sh'), '#!/bin/sh\n# comment\nset -e\n');
    writeFileSync(
      join(hooksDir, 'h6.json'),
      JSON.stringify({ hooks: { preToolUse: [{ bash: './empty.sh' }] } }),
    );
    expect(await runImport()).toEqual([]);
  });

  it('skips events whose JSON name does not map to a canonical event', async () => {
    const hooksDir = join(projectRoot, COPILOT_HOOKS_DIR);
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(join(hooksDir, 'cmd.sh'), 'pnpm test');
    writeFileSync(
      join(hooksDir, 'h7.json'),
      JSON.stringify({ hooks: { unsupported: [{ bash: './cmd.sh' }] } }),
    );
    expect(await runImport()).toEqual([]);
  });

  it('ignores legacy script files that do not match the {phase}-{n}.sh pattern', async () => {
    mkdirSync(join(projectRoot, COPILOT_LEGACY_HOOKS_DIR), { recursive: true });
    writeFileSync(
      join(projectRoot, COPILOT_LEGACY_HOOKS_DIR, 'no-index.sh'),
      '#!/bin/sh\npnpm test\n',
    );
    expect(await runImport()).toEqual([]);
  });

  it('ignores legacy scripts located in subdirectories of copilot-hooks', async () => {
    const nested = join(projectRoot, COPILOT_LEGACY_HOOKS_DIR, 'nested');
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(nested, 'PostToolUse-0.sh'), '#!/bin/sh\npnpm test\n');
    expect(await runImport()).toEqual([]);
  });

  it('groups multiple legacy scripts under the same phase preserving order', async () => {
    const dir = join(projectRoot, COPILOT_LEGACY_HOOKS_DIR);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'PreToolUse-0.sh'), '#!/bin/sh\npnpm a\n');
    writeFileSync(join(dir, 'PreToolUse-1.sh'), '#!/bin/sh\npnpm b\n');
    const results = await runImport();
    expect(results).toHaveLength(1);
    const hooks = parseYaml(
      readFileSync(join(projectRoot, '.agentsmesh/hooks.yaml'), 'utf-8'),
    ) as Record<string, Array<{ command: string }>>;
    expect(hooks['PreToolUse']).toHaveLength(2);
    const commands = hooks['PreToolUse']!.map((h) => h.command).sort();
    expect(commands).toEqual(['pnpm a', 'pnpm b']);
  });
});
