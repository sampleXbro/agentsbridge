import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cmdHandlers } from '../../../src/cli/command-handlers.js';
import { runWatch } from '../../harness/watch.js';
import { runInstall } from '../../../src/cli/commands/install.js';
import { runPlugin } from '../../../src/cli/commands/plugin.js';
import { runTarget } from '../../../src/cli/commands/target.js';
import { renderInstall } from '../../../src/cli/renderers/install.js';
import { renderPlugin } from '../../../src/cli/renderers/plugin.js';
import { renderTarget } from '../../../src/cli/renderers/target.js';
import { handleResult } from '../../../src/cli/json-handler.js';
import { emitJson } from '../../../src/cli/json-output.js';

vi.mock('../../../src/cli/commands/watch.js', () => ({ runWatch: vi.fn() }));
vi.mock('../../../src/cli/commands/install.js', () => ({ runInstall: vi.fn() }));
vi.mock('../../../src/cli/commands/plugin.js', () => ({ runPlugin: vi.fn() }));
vi.mock('../../../src/cli/commands/target.js', () => ({ runTarget: vi.fn() }));
vi.mock('../../../src/cli/renderers/install.js', () => ({ renderInstall: vi.fn() }));
vi.mock('../../../src/cli/renderers/plugin.js', () => ({ renderPlugin: vi.fn() }));
vi.mock('../../../src/cli/renderers/target.js', () => ({ renderTarget: vi.fn() }));
vi.mock('../../../src/cli/json-output.js', () => ({ emitJson: vi.fn() }));
vi.mock('../../../src/cli/json-handler.js', () => ({ handleResult: vi.fn() }));

describe('cmdHandlers watch/install/plugin/target', () => {
  const installResult = {
    exitCode: 0,
    data: { source: 'pack', mode: 'install' as const, installed: [], skipped: [], dryRun: false },
  };
  const pluginResult = {
    exitCode: 0,
    data: { subcommand: 'list' as const, plugins: [] },
  };
  const targetResult = {
    exitCode: 0,
    data: { id: 'acme', written: [], skipped: [], postSteps: [] },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(runInstall).mockResolvedValue(installResult);
    vi.mocked(runPlugin).mockResolvedValue(pluginResult);
    vi.mocked(runTarget).mockResolvedValue(targetResult);
    vi.mocked(handleResult).mockImplementation((_command, _result, flags, render) => {
      if (flags.json !== true) render();
    });
  });

  it('rejects watch JSON mode before starting the watcher', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await cmdHandlers.watch({ json: true }, []);

    expect(emitJson).toHaveBeenCalledWith('watch', {
      success: false,
      error: '--json is not supported with watch',
    });
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(runWatch).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });

  it('starts watch mode and wires signal cleanup callbacks', async () => {
    const stop = vi.fn().mockResolvedValue(undefined);
    let sigintListener: NodeJS.SignalsListener | undefined;
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const onSpy = vi.spyOn(process, 'on').mockImplementation((event, listener) => {
      if (event === 'SIGINT') sigintListener = listener as NodeJS.SignalsListener;
      return process;
    });
    vi.mocked(runWatch).mockResolvedValue({ stop });

    await cmdHandlers.watch({}, []);
    sigintListener?.('SIGINT');
    await Promise.resolve();

    expect(runWatch).toHaveBeenCalledWith({});
    expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(stop).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);

    onSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('forces install in JSON mode and preserves text-mode flags', async () => {
    const jsonFlags = { json: true };
    const textFlags = {};

    await cmdHandlers.install(jsonFlags, ['pack']);
    await cmdHandlers.install(textFlags, ['pack']);

    expect(runInstall).toHaveBeenNthCalledWith(
      1,
      { json: true, force: true },
      ['pack'],
      process.cwd(),
    );
    expect(runInstall).toHaveBeenNthCalledWith(2, textFlags, ['pack'], process.cwd());
    expect(renderInstall).toHaveBeenCalledWith(installResult);
  });

  it('delegates plugin and target commands through structured results', async () => {
    await cmdHandlers.plugin({}, ['list']);
    await cmdHandlers.target({}, ['scaffold', 'acme']);

    expect(runPlugin).toHaveBeenCalledWith({}, ['list'], process.cwd());
    expect(renderPlugin).toHaveBeenCalledWith(pluginResult);
    expect(runTarget).toHaveBeenCalledWith({}, ['scaffold', 'acme'], process.cwd());
    expect(renderTarget).toHaveBeenCalledWith(targetResult);
  });
});
