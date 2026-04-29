/**
 * Branch coverage targeted tests for src/cli/commands/import.ts.
 * Covers:
 *   - missing --from (boolean true / non-string)
 *   - case-insensitive normalization (uppercase + extra whitespace)
 *   - builtin happy path with empty result (logs emptyImportMessage)
 *   - non-builtin descriptor path: agentsmesh.yaml missing → unknown --from error
 *   - non-builtin descriptor path: agentsmesh.yaml present but descriptor missing
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runImport } from '../../../../src/cli/commands/import.js';

const TEST_DIR = join(tmpdir(), 'am-import-branches-test');

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('runImport — --from validation branches', () => {
  it('throws when --from is boolean true (non-string)', async () => {
    await expect(runImport({ from: true }, TEST_DIR)).rejects.toThrow(/required/i);
  });

  it('throws when --from is an empty string (falsy)', async () => {
    await expect(runImport({ from: '' }, TEST_DIR)).rejects.toThrow(/required/i);
  });

  it('throws when --from is missing entirely', async () => {
    await expect(runImport({}, TEST_DIR)).rejects.toThrow(/required/i);
  });
});

describe('runImport — case + whitespace normalization branches', () => {
  it('accepts mixed-case "Claude-Code" (lowercased before lookup)', async () => {
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '# Root\n');
    await runImport({ from: 'Claude-Code' }, TEST_DIR);
    expect(existsSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'))).toBe(true);
  });

  it('accepts " claude-code " (trim before lookup)', async () => {
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '# Root\n');
    await runImport({ from: ' claude-code ' }, TEST_DIR);
    expect(existsSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'))).toBe(true);
  });
});

describe('runImport — builtin empty results branch', () => {
  it('logs emptyImportMessage and returns when builtin import yields zero files', async () => {
    // No claude artifacts exist → results.length === 0, info branch executes,
    // function returns without writing .agentsmesh/.
    await runImport({ from: 'claude-code' }, TEST_DIR);
    expect(existsSync(join(TEST_DIR, '.agentsmesh'))).toBe(false);
  });
});

describe('runImport — non-builtin / unknown --from descriptor lookup branches', () => {
  it('throws "Unknown --from" with init suggestion when agentsmesh.yaml is missing (loadScopedConfig fails)', async () => {
    // No agentsmesh.yaml here, --from is not a builtin → loadScopedConfig throws
    await expect(runImport({ from: 'totally-unknown-tool' }, TEST_DIR)).rejects.toThrow(
      /no agentsmesh\.yaml found/i,
    );
  });

  it('throws "Unknown --from" with supported list when config exists but descriptor missing', async () => {
    // Write a minimal agentsmesh.yaml so loadScopedConfig succeeds but the
    // unknown id has no descriptor → second throw branch with supported list.
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
`,
    );
    await expect(runImport({ from: 'no-such-target' }, TEST_DIR)).rejects.toThrow(
      /Unknown --from "no-such-target"\.?\s*Supported:/i,
    );
  });
});
