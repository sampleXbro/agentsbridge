/**
 * Branch coverage for src/cli/error-handler.ts line 17:
 * - CliUsageError → exit code 2 (was previously only the 'else: 1' branch tested).
 */

import { afterEach, describe, it, expect, vi } from 'vitest';
import { handleError } from '../../../src/cli/error-handler.js';
import { CliUsageError } from '../../../src/cli/cli-error.js';

describe('handleError — CliUsageError branch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exits with code 2 for CliUsageError', () => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    handleError(new CliUsageError('Usage: agentsmesh <cmd>'));
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it('exits with code 2 for CliUsageError under --json mode', () => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    handleError(new CliUsageError('Usage: agentsmesh <cmd>'), { json: true, command: 'cmd' });
    expect(exitSpy).toHaveBeenCalledWith(2);
  });
});
