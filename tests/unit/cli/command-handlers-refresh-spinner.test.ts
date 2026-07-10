/**
 * Refresh handler must skip the spinner when the run may prompt, so the
 * refresh drift consent prompt (run-refresh.ts → runConsentPrompt → readLine)
 * is not clobbered by the 'Refreshing…' spinner's redraw timer. Mirrors the
 * install/uninstall spinner-gating tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cmdHandlers } from '../../../src/cli/command-handlers.js';
import { runRefresh } from '../../../src/cli/commands/refresh.js';
import { handleResult } from '../../../src/cli/json-handler.js';
import { ui } from '../../../src/cli/ui/ui.js';

vi.mock('../../../src/cli/commands/refresh.js', () => ({ runRefresh: vi.fn() }));
vi.mock('../../../src/cli/renderers/refresh.js', () => ({ renderRefresh: vi.fn() }));
vi.mock('../../../src/cli/json-handler.js', () => ({ handleResult: vi.fn() }));

describe('cmdHandlers.refresh — spinner gating', () => {
  const refreshResult = {
    exitCode: 0,
    data: { scope: 'project' as const, refreshed: [], unchanged: [], skipped: [], failed: [] },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(runRefresh).mockResolvedValue(refreshResult);
    vi.mocked(handleResult).mockImplementation((_command, _result, flags, render) => {
      if (flags.json !== true) render();
    });
  });

  function withTty<T>(fn: () => Promise<T>): Promise<T> {
    const inDesc = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
    const outDesc = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    return fn().finally(() => {
      if (inDesc) Object.defineProperty(process.stdin, 'isTTY', inDesc);
      if (outDesc) Object.defineProperty(process.stdout, 'isTTY', outDesc);
    });
  }

  it('skips the spinner on an interactive TTY so the consent prompt is not clobbered', async () => {
    const start = vi.fn();
    const spinnerSpy = vi
      .spyOn(ui, 'spinner')
      .mockReturnValue({ start, stop: vi.fn(), message: vi.fn() });
    try {
      await withTty(() => cmdHandlers.refresh({}, []));
      expect(ui.spinner).not.toHaveBeenCalled();
      expect(start).not.toHaveBeenCalled();
      expect(runRefresh).toHaveBeenCalledWith({}, [], process.cwd());
    } finally {
      spinnerSpy.mockRestore();
    }
  });

  it('runs the spinner when non-interactive (--force bypasses the consent prompt)', async () => {
    const start = vi.fn();
    const spinnerSpy = vi
      .spyOn(ui, 'spinner')
      .mockReturnValue({ start, stop: vi.fn(), message: vi.fn() });
    try {
      await withTty(() => cmdHandlers.refresh({ force: true }, []));
      expect(start).toHaveBeenCalledWith('Refreshing…');
    } finally {
      spinnerSpy.mockRestore();
    }
  });
});
