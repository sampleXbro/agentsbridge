/**
 * Branch coverage for projectRoot ?? process.cwd() fallbacks across
 * diff/check/merge/lint/matrix command entry points.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runDiff } from '../../../../src/cli/commands/diff.js';
import { runCheck } from '../../../../src/cli/commands/check.js';
import { runMerge } from '../../../../src/cli/commands/merge.js';
import { runLintCmd } from '../../../../src/cli/commands/lint.js';

let tmp = '';
let prevCwd = '';

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'am-cli-cwd-'));
  mkdirSync(join(tmp, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(tmp, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code]\nfeatures: [rules]\nextends: []\n',
  );
  writeFileSync(
    join(tmp, '.agentsmesh', 'rules', '_root.md'),
    '---\nroot: true\n---\n\nRoot rule body.\n',
  );
  prevCwd = process.cwd();
  process.chdir(tmp);
});

afterEach(() => {
  process.chdir(prevCwd);
  rmSync(tmp, { recursive: true, force: true });
});

describe('projectRoot fallback branch — process.cwd() default', () => {
  it('runDiff resolves projectRoot from process.cwd() when no argument is provided', async () => {
    const result = await runDiff({});
    expect(result.exitCode).toBe(0);
  });

  it('runCheck returns hasLock=false when no lock present (cwd default)', async () => {
    const result = await runCheck({});
    expect(result.exitCode).toBe(1);
    expect(result.data.hasLock).toBe(false);
  });

  it('runMerge returns hadConflict=false when no conflict markers (cwd default)', async () => {
    const result = await runMerge({});
    expect(result.exitCode).toBe(0);
    expect(result.data.hadConflict).toBe(false);
  });

  it('runLintCmd returns diagnostics array (cwd default)', async () => {
    const result = await runLintCmd({});
    expect(result.exitCode).toBeTypeOf('number');
    expect(Array.isArray(result.data.diagnostics)).toBe(true);
    expect(existsSync(join(tmp, '.agentsmesh'))).toBe(true);
  });
});
