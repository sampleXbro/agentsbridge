/**
 * `src/cli/commands/refresh.ts` is a one-function delegation wrapper around the
 * install-side `runRefresh`. Prove it forwards (flags, args, projectRoot) by
 * reference and returns the underlying result untouched.
 */
import { describe, it, expect, vi } from 'vitest';
import type { RefreshCommandResult } from '../../../../src/install/refresh/refresh-result.js';

const mocks = vi.hoisted(() => ({ runRefreshCore: vi.fn() }));

vi.mock('../../../../src/install/refresh/run-refresh.js', () => ({
  runRefresh: mocks.runRefreshCore,
}));

import { runRefresh } from '../../../../src/cli/commands/refresh.js';

describe('runRefresh (CLI wrapper)', () => {
  it('forwards flags/args/projectRoot verbatim and returns the core result', async () => {
    const sentinel: RefreshCommandResult = {
      exitCode: 0,
      data: {
        scope: 'project',
        mode: 'refresh',
        refreshed: [],
        unchanged: [],
        skipped: [],
        failed: [],
        dryRun: true,
      },
    };
    mocks.runRefreshCore.mockResolvedValueOnce(sentinel);
    const flags = { 'dry-run': true, global: false };
    const args = ['pack-a', 'pack-b'];
    const projectRoot = '/tmp/am-refresh-root';

    const result = await runRefresh(flags, args, projectRoot);

    expect(mocks.runRefreshCore).toHaveBeenCalledTimes(1);
    expect(mocks.runRefreshCore).toHaveBeenCalledWith(flags, args, projectRoot);
    const call = mocks.runRefreshCore.mock.calls[0];
    expect(call?.[0]).toBe(flags);
    expect(call?.[1]).toBe(args);
    expect(call?.[2]).toBe(projectRoot);
    expect(result).toBe(sentinel);
  });
});
