/**
 * Branch coverage for the thin `runInstall` wrapper in `src/cli/commands/install.ts`.
 * Confirms the wrapper forwards flags/args/projectRoot verbatim and returns the
 * underlying result unchanged.
 */
import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runInstallCore: vi.fn().mockResolvedValue({
    exitCode: 0,
    data: { source: 'src', mode: 'install', dryRun: false, installed: [], skipped: [] },
  }),
}));

vi.mock('../../../../src/install/run/run-install.js', () => ({
  runInstall: mocks.runInstallCore,
}));

import { runInstall } from '../../../../src/cli/commands/install.js';

describe('runInstall (CLI wrapper)', () => {
  it('forwards flags/args/projectRoot to the underlying runInstall and returns its result', async () => {
    const flags = { force: true };
    const args = ['pack-src'];
    const projectRoot = '/tmp/some-root';

    const result = await runInstall(flags, args, projectRoot);

    expect(mocks.runInstallCore).toHaveBeenCalledTimes(1);
    expect(mocks.runInstallCore).toHaveBeenCalledWith(flags, args, projectRoot);
    expect(result.exitCode).toBe(0);
  });
});
