/**
 * Branch coverage for the `uninstall`, `installs`, and `mcp` cmdHandlers
 * in `src/cli/command-handlers.ts`. The existing `command-handlers.test.ts`
 * covers generate/init/import/etc. but not these three handlers, leaving
 * lines 105-111 and 127 uncovered.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cmdHandlers } from '../../../src/cli/command-handlers.js';
import { runInstall } from '../../../src/cli/commands/install.js';
import { runUninstall } from '../../../src/cli/commands/uninstall.js';
import { runInstalls } from '../../../src/cli/commands/installs.js';
import { runMcp } from '../../../src/cli/commands/mcp.js';
import { renderInstall } from '../../../src/cli/renderers/install.js';
import { renderUninstall } from '../../../src/cli/renderers/uninstall.js';
import { renderInstalls } from '../../../src/cli/renderers/installs.js';
import { handleResult } from '../../../src/cli/json-handler.js';

vi.mock('../../../src/cli/commands/install.js', () => ({ runInstall: vi.fn() }));
vi.mock('../../../src/cli/commands/uninstall.js', () => ({ runUninstall: vi.fn() }));
vi.mock('../../../src/cli/commands/installs.js', () => ({ runInstalls: vi.fn() }));
vi.mock('../../../src/cli/commands/mcp.js', () => ({ runMcp: vi.fn() }));
vi.mock('../../../src/cli/renderers/install.js', () => ({ renderInstall: vi.fn() }));
vi.mock('../../../src/cli/renderers/uninstall.js', () => ({ renderUninstall: vi.fn() }));
vi.mock('../../../src/cli/renderers/installs.js', () => ({ renderInstalls: vi.fn() }));
vi.mock('../../../src/cli/json-handler.js', () => ({ handleResult: vi.fn() }));

describe('cmdHandlers — install/uninstall/installs/mcp', () => {
  const installResult = {
    exitCode: 0,
    data: {
      source: 'github:a/b',
      mode: 'install' as const,
      installed: [],
      skipped: [],
      dryRun: false,
    },
  };
  const uninstallResult = {
    exitCode: 0,
    data: {
      scope: 'project' as const,
      mode: 'uninstall' as const,
      removed: [],
      skipped: [],
      failed: [],
      dryRun: false,
    },
  };
  const installsResult = {
    exitCode: 0,
    data: { scope: 'project' as const, subcommand: 'list' as const, installs: [] },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(runInstall).mockResolvedValue(installResult);
    vi.mocked(runUninstall).mockResolvedValue(uninstallResult);
    vi.mocked(runInstalls).mockResolvedValue(installsResult);
    vi.mocked(runMcp).mockResolvedValue(undefined);
    vi.mocked(handleResult).mockImplementation((_command, _result, flags, render) => {
      if (flags.json !== true) render();
    });
  });

  it('install handler forces --force when --json is set, then renders', async () => {
    await cmdHandlers.install({ json: true }, ['github:a/b']);
    expect(runInstall).toHaveBeenCalledWith(
      expect.objectContaining({ json: true, force: true }),
      ['github:a/b'],
      process.cwd(),
    );
  });

  it('install handler calls the human renderer in non-JSON mode', async () => {
    await cmdHandlers.install({}, ['github:a/b']);
    expect(renderInstall).toHaveBeenCalled();
  });

  it('uninstall handler forces --force when --json is set, then renders', async () => {
    await cmdHandlers.uninstall({ json: true }, ['pack-name']);
    expect(runUninstall).toHaveBeenCalledWith(
      expect.objectContaining({ json: true, force: true }),
      ['pack-name'],
      process.cwd(),
    );
  });

  it('uninstall handler calls the human renderer in non-JSON mode', async () => {
    await cmdHandlers.uninstall({}, ['pack-name']);
    expect(renderUninstall).toHaveBeenCalled();
  });

  it('installs handler routes through handleResult and renders the list', async () => {
    await cmdHandlers.installs({}, ['list']);
    expect(runInstalls).toHaveBeenCalledWith({}, ['list'], process.cwd());
    expect(renderInstalls).toHaveBeenCalled();
  });

  it('mcp handler calls runMcp with the passed flags and args', async () => {
    await cmdHandlers.mcp({ port: '3000' }, ['serve']);
    expect(runMcp).toHaveBeenCalledWith({ port: '3000' }, ['serve']);
  });
});
