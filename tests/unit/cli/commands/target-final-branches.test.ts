/**
 * Branch coverage for src/cli/commands/target.ts:
 * - error path: writeTargetScaffold throws Error vs non-Error (line 73).
 * - relativize: path NOT starting with projectRoot (line 89).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runTarget } from '../../../../src/cli/commands/target.js';
import * as scaffoldMod from '../../../../src/cli/commands/target-scaffold/writer.js';

let projectRoot = '';

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'am-target-final-'));
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('runTarget — error path branches', () => {
  it('returns exitCode 1 with Error.message when writeTargetScaffold throws an Error', async () => {
    vi.spyOn(scaffoldMod, 'writeTargetScaffold').mockRejectedValue(new Error('scaffold blew up'));
    const result = await runTarget({}, ['scaffold', 'pluginx'], projectRoot);
    expect(result.exitCode).toBe(1);
    expect(result.error).toBe('scaffold blew up');
  });

  it('returns exitCode 1 with String(err) when writeTargetScaffold throws a non-Error', async () => {
    vi.spyOn(scaffoldMod, 'writeTargetScaffold').mockRejectedValue('plain-string');
    const result = await runTarget({}, ['scaffold', 'pluginx'], projectRoot);
    expect(result.exitCode).toBe(1);
    expect(result.error).toBe('plain-string');
  });

  it('relativizes paths outside projectRoot by leaving them absolute', async () => {
    vi.spyOn(scaffoldMod, 'writeTargetScaffold').mockResolvedValue({
      written: ['/abs/path/foo.ts'],
      skipped: ['/abs/path/bar.ts'],
      postSteps: ['build'],
    });
    const result = await runTarget({}, ['scaffold', 'pluginx'], projectRoot);
    expect(result.exitCode).toBe(0);
    expect(result.data.written).toEqual(['/abs/path/foo.ts']);
    expect(result.data.skipped).toEqual(['/abs/path/bar.ts']);
  });

  it('relativizes paths under projectRoot and normalizes separators to forward slashes', async () => {
    vi.spyOn(scaffoldMod, 'writeTargetScaffold').mockResolvedValue({
      written: [join(projectRoot, 'src', 'mod.ts')],
      skipped: [],
      postSteps: [],
    });
    const result = await runTarget({}, ['scaffold', 'pluginx'], projectRoot);
    expect(result.data.written).toEqual(['src/mod.ts']);
  });

  it('returns showHelp for unknown subcommand', async () => {
    const result = await runTarget({}, ['bogus'], projectRoot);
    expect(result.exitCode).toBe(2);
    expect(result.showHelp).toBe(true);
    expect(result.error).toContain('bogus');
  });

  it('returns showHelp when no subcommand given', async () => {
    const result = await runTarget({}, [], projectRoot);
    expect(result.exitCode).toBe(0);
    expect(result.showHelp).toBe(true);
  });
});
