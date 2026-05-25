import { describe, it, expect, vi } from 'vitest';
import {
  runInstallMarketplace,
  type MarketplaceExecutor,
} from '../../../src/install/run/run-install-marketplace.js';
import { createInstallReport } from '../../../src/install/core/install-report.js';
import type { InstallTarget } from '../../../src/install/core/install-target.js';

function target(name: string, path: string | undefined): InstallTarget {
  return { name, source: 'github:t/r@v', path: path ?? '', features: ['skills'] };
}

describe('runInstallMarketplace — branch gaps', () => {
  it('records String(err) when the rejected value is not an Error instance', async () => {
    const executor: MarketplaceExecutor = vi.fn().mockRejectedValue('plain-string-failure');
    const report = createInstallReport();
    const result = await runInstallMarketplace([target('only', 'plugins/x')], executor, report);
    expect(result.exitCode).toBe(1);
    expect(report.subPackFailures).toHaveLength(1);
    expect(report.subPackFailures[0].error).toBe('plain-string-failure');
  });

  it('records target.path as "." when the failing target has an undefined path', async () => {
    const executor: MarketplaceExecutor = vi.fn().mockRejectedValue(new Error('boom'));
    const report = createInstallReport();
    // Construct a target where path is the empty string after the helper's
    // default; force undefined to exercise the `target.path ?? '.'` fallback.
    const t = { ...target('t', undefined), path: undefined as unknown as string };
    const result = await runInstallMarketplace([t], executor, report);
    expect(result.exitCode).toBe(1);
    expect(report.subPackFailures[0].path).toBe('.');
  });
});
