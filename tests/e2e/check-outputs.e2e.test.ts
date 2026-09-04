/**
 * E2E tests for `agentsmesh check` generated-output verification (issue #98).
 *
 * `generate` records a `sha256` of every generated output in `.agentsmesh/.lock`;
 * `check` fails when a lock-recorded output was hand-edited or deleted, distinct
 * from canonical drift. Old-format locks (no `outputs` map) and `--no-outputs`
 * skip the verification. These cases mirror the exact repro from the issue.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { cleanup, createTestProject } from './helpers/setup.js';
import { runCli } from './helpers/run-cli.js';

interface CheckData {
  hasLock: boolean;
  canonicalDrift: boolean;
  outputDrift: boolean;
  inSync: boolean;
  modified: string[];
  added: string[];
  removed: string[];
  extendsModified: string[];
  lockedViolations: string[];
  outputsModified: string[];
  outputsRemoved: string[];
  outputsStale: string[];
  outputsChecked: boolean;
}

interface CheckEnvelope {
  command: string;
  success: boolean;
  data: CheckData;
}

/** POSIX-normalize every path in a message for cross-platform assertions. */
function posix(s: string): string {
  return s.replaceAll('\\', '/');
}

function parseCheck(stdout: string): CheckEnvelope {
  return JSON.parse(stdout) as CheckEnvelope;
}

/**
 * Rewrite `.agentsmesh/.lock` to an old-format lock by dropping the trailing
 * top-level `outputs:` block (the last section the generator emits).
 */
function stripOutputsBlock(lockPath: string): void {
  const lines = readFileSync(lockPath, 'utf-8').split('\n');
  const idx = lines.findIndex((l) => l.startsWith('outputs:'));
  if (idx === -1) throw new Error('lock has no outputs: block to strip');
  writeFileSync(lockPath, lines.slice(0, idx).join('\n').replace(/\n+$/, '') + '\n');
}

describe('check generated-output verification (e2e)', () => {
  let dir = '';

  afterEach(() => {
    if (dir) cleanup(dir);
    dir = '';
  });

  it('hand-edited generated output → exit 1, outputsModified exactly [AGENTS.md]', async () => {
    dir = createTestProject('canonical-full');
    await runCli('generate', dir);

    appendFileSync(join(dir, 'AGENTS.md'), '\n# hand edit\n');

    const r = await runCli('check --json', dir);
    expect(r.exitCode).toBe(1);
    const { data } = parseCheck(r.stdout);
    expect(data.inSync).toBe(false);
    expect(data.outputsChecked).toBe(true);
    expect(data.canonicalDrift).toBe(false);
    expect(data.outputDrift).toBe(true);
    expect(data.outputsModified).toEqual(['AGENTS.md']);
    expect(data.outputsRemoved).toEqual([]);
    expect(data.outputsStale).toEqual([]);
    expect(data.modified).toEqual([]);
  });

  it('deleted generated output → exit 1, outputsRemoved exactly [AGENTS.md]', async () => {
    dir = createTestProject('canonical-full');
    await runCli('generate', dir);

    rmSync(join(dir, 'AGENTS.md'));

    const r = await runCli('check --json', dir);
    expect(r.exitCode).toBe(1);
    const { data } = parseCheck(r.stdout);
    expect(data.inSync).toBe(false);
    expect(data.outputsChecked).toBe(true);
    expect(data.canonicalDrift).toBe(false);
    expect(data.outputDrift).toBe(true);
    expect(data.outputsRemoved).toEqual(['AGENTS.md']);
    expect(data.outputsModified).toEqual([]);
    expect(data.outputsStale).toEqual([]);
    expect(data.modified).toEqual([]);
  });

  it('hand-added managed-dir file → exit 0, reported as a notice, never deleted', async () => {
    dir = createTestProject('canonical-full');
    await runCli('generate', dir);

    const stalePath = join(dir, '.cursor', 'rules', 'orphaned.mdc');
    mkdirSync(join(dir, '.cursor', 'rules'), { recursive: true });
    writeFileSync(stalePath, '# hand-added output\n');

    const r = await runCli('check --json', dir);
    expect(r.exitCode).toBe(0);
    const { data } = parseCheck(r.stdout);
    expect(data.canonicalDrift).toBe(false);
    expect(data.outputDrift).toBe(false);
    expect(data.outputsStale).toEqual([]);
    expect(data.outputsUntracked).toEqual(['.cursor/rules/orphaned.mdc']);
    expect(data.outputsModified).toEqual([]);
    expect(data.outputsRemoved).toEqual([]);
    expect(existsSync(stalePath)).toBe(true);
  });

  it('edited canonical file → exit 1, modified set but outputsModified empty', async () => {
    dir = createTestProject('canonical-full');
    await runCli('generate', dir);

    appendFileSync(join(dir, '.agentsmesh', 'rules', 'typescript.md'), '\n- extra rule\n');

    const r = await runCli('check --json', dir);
    expect(r.exitCode).toBe(1);
    const { data } = parseCheck(r.stdout);
    expect(data.inSync).toBe(false);
    expect(data.outputsChecked).toBe(true);
    expect(data.canonicalDrift).toBe(true);
    expect(data.outputDrift).toBe(false);
    expect(data.modified).toEqual(['rules/typescript.md']);
    expect(data.outputsModified).toEqual([]);
    expect(data.outputsRemoved).toEqual([]);
    expect(data.outputsStale).toEqual([]);
  });

  it('old-format lock (no outputs block) → exit 0, outputsChecked:false', async () => {
    dir = createTestProject('canonical-full');
    await runCli('generate', dir);

    // Hand-edit a generated output that would normally fail the check…
    appendFileSync(join(dir, 'AGENTS.md'), '\n# hand edit\n');
    // …but strip the outputs map so verification is skipped (old-format lock).
    stripOutputsBlock(join(dir, '.agentsmesh', '.lock'));

    const r = await runCli('check --json', dir);
    expect(r.exitCode).toBe(0);
    const { data } = parseCheck(r.stdout);
    expect(data.inSync).toBe(true);
    expect(data.outputsChecked).toBe(false);
    expect(data.canonicalDrift).toBe(false);
    expect(data.outputDrift).toBe(false);
    expect(data.outputsModified).toEqual([]);
    expect(data.outputsRemoved).toEqual([]);
    expect(data.outputsStale).toEqual([]);
  });

  it('old-format lock → human output prints the skipped-verification note', async () => {
    dir = createTestProject('canonical-full');
    await runCli('generate', dir);
    stripOutputsBlock(join(dir, '.agentsmesh', '.lock'));

    const r = await runCli('check', dir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout + r.stderr).toContain(
      "Generated-output verification skipped; run 'agentsmesh generate' to refresh the lock and enable it.",
    );
  });

  it('--no-outputs skips verification even with a hand-edited output → exit 0', async () => {
    dir = createTestProject('canonical-full');
    await runCli('generate', dir);

    appendFileSync(join(dir, 'AGENTS.md'), '\n# hand edit\n');

    const r = await runCli('check --no-outputs --json', dir);
    expect(r.exitCode).toBe(0);
    const { data } = parseCheck(r.stdout);
    expect(data.inSync).toBe(true);
    expect(data.outputsChecked).toBe(false);
    expect(data.canonicalDrift).toBe(false);
    expect(data.outputDrift).toBe(false);
    expect(data.outputsModified).toEqual([]);
    expect(data.outputsStale).toEqual([]);
  });

  it('human (non-JSON) drift output names the modified generated output on stderr', async () => {
    dir = createTestProject('canonical-full');
    await runCli('generate', dir);

    appendFileSync(join(dir, 'AGENTS.md'), '\n# hand edit\n');

    const r = await runCli('check', dir);
    expect(r.exitCode).toBe(1);
    expect(posix(r.stderr)).toContain('generated output "AGENTS.md" was modified');
  });
});
