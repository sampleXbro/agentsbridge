import { handleResult } from './json-handler.js';
import { emitJson } from './json-output.js';
import { runGenerate } from './commands/generate.js';
import { renderGenerate } from './renderers/generate.js';
import { runInit } from './commands/init.js';
import { renderInit } from './renderers/init.js';
import { runImport } from './commands/import.js';
import { runDiff } from './commands/diff.js';
import { runLintCmd } from './commands/lint.js';
import { renderLint } from './renderers/lint.js';
import { renderCheck } from './renderers/check.js';
import { renderImport } from './renderers/import.js';
import { renderDiff } from './renderers/diff.js';
import { renderMerge } from './renderers/merge.js';
import { runMatrix } from './commands/matrix.js';
import { renderMatrix } from './renderers/matrix.js';
import { runWatch } from './commands/watch.js';
import { runCheck } from './commands/check.js';
import { runMerge } from './commands/merge.js';
import { runInstall } from './commands/install.js';
import { renderInstall } from './renderers/install.js';
import { runPlugin } from './commands/plugin.js';
import { renderPlugin } from './renderers/plugin.js';
import { runTarget } from './commands/target.js';
import { renderTarget } from './renderers/target.js';
import { runConvert } from './commands/convert.js';
import { renderConvert } from './renderers/convert.js';

export const cmdHandlers: Record<
  string,
  (flags: Record<string, string | boolean>, args: string[]) => Promise<void>
> = {
  generate: async (flags, _args) => {
    void _args;
    const result = await runGenerate(flags, undefined, {
      printMatrix: flags.json !== true,
    });
    handleResult('generate', result, flags, () => renderGenerate(result));
  },
  init: async (flags, _args) => {
    void _args;
    const result = await runInit(process.cwd(), {
      yes: flags.yes === true,
      global: flags.global === true,
    });
    handleResult('init', result, flags, () => renderInit(result));
  },
  import: async (flags, _args) => {
    void _args;
    const result = await runImport(flags);
    handleResult('import', result, flags, () => renderImport(result));
  },
  diff: async (flags, _args) => {
    void _args;
    const result = await runDiff(flags);
    handleResult('diff', result, flags, () => renderDiff(result));
  },
  lint: async (flags, _args) => {
    void _args;
    const result = await runLintCmd(flags);
    handleResult('lint', result, flags, () => renderLint(result));
  },
  check: async (flags, _args) => {
    void _args;
    const result = await runCheck(flags);
    handleResult('check', result, flags, () => renderCheck(result));
  },
  merge: async (flags, _args) => {
    void _args;
    const result = await runMerge(flags);
    handleResult('merge', result, flags, () => renderMerge(result));
  },
  matrix: async (flags, args) => {
    void args;
    const result = await runMatrix(flags);
    handleResult('matrix', result, flags, () =>
      renderMatrix(result, { verbose: flags.verbose === true }),
    );
  },
  watch: async (flags, _args) => {
    void _args;
    if (flags.json === true) {
      emitJson('watch', { success: false, error: '--json is not supported with watch' });
      process.exit(1);
      return;
    }
    const handle = await runWatch(flags);
    const stop = (): void => {
      void handle.stop().then(() => process.exit(0));
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  },
  install: async (flags, args) => {
    if (flags.json === true) flags.force = true;
    const result = await runInstall(flags, args, process.cwd());
    handleResult('install', result, flags, () => renderInstall(result));
  },
  plugin: async (flags, args) => {
    const result = await runPlugin(flags, args, process.cwd());
    handleResult('plugin', result, flags, () => renderPlugin(result));
  },
  target: async (flags, args) => {
    const result = await runTarget(flags, args, process.cwd());
    handleResult('target', result, flags, () => renderTarget(result));
  },
  convert: async (flags, _args) => {
    void _args;
    const result = await runConvert(flags);
    handleResult('convert', result, flags, () => renderConvert(result));
  },
};
