import type { CliFlags } from './index.js';
import type { CommandHandler } from './router.js';
import { handleResult } from './json-handler.js';
import { emitJson } from './json-output.js';
import { runGenerate } from './commands/generate.js';
import { renderGenerate } from './renderers/generate.js';
import { runInit } from './commands/init.js';
import { renderInit } from './renderers/init.js';
import { createClackPrompter } from './prompts/clack-prompter.js';
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
import { runUninstall } from './commands/uninstall.js';
import { renderUninstall } from './renderers/uninstall.js';
import { runRefresh } from './commands/refresh.js';
import { renderRefresh } from './renderers/refresh.js';
import { runInstalls } from './commands/installs.js';
import { renderInstalls } from './renderers/installs.js';
import { runPlugin } from './commands/plugin.js';
import { renderPlugin } from './renderers/plugin.js';
import { runTarget } from './commands/target.js';
import { renderTarget } from './renderers/target.js';
import { runConvert } from './commands/convert.js';
import { renderConvert } from './renderers/convert.js';
import { runMcp } from './commands/mcp.js';
import { runLessons } from './commands/lessons.js';
import { renderLessons } from './renderers/lessons.js';

/**
 * Collapse repeated-flag arrays to their last value for the (vast majority of)
 * commands whose handlers expect a single value per flag. Only `lessons`
 * consumes repeated flags (multiple `--trigger-file`), so it receives the full
 * {@link CliFlags} untouched; every other command keeps last-wins semantics.
 */
function narrowFlags(flags: CliFlags): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  // A repeated flag is a non-empty array, so the last element is always present.
  for (const [k, v] of Object.entries(flags)) out[k] = Array.isArray(v) ? v[v.length - 1]! : v;
  return out;
}

export const cmdHandlers: Record<string, CommandHandler> = {
  generate: async (flags, _args) => {
    void _args;
    const nf = narrowFlags(flags);
    const result = await runGenerate(nf, undefined, { printMatrix: nf.json !== true });
    handleResult('generate', result, nf, () => renderGenerate(result));
  },
  init: async (flags, _args) => {
    void _args;
    // Interactive only on a real project-scope TTY; --yes/--json/--global bypass it.
    const interactive =
      process.stdin.isTTY === true &&
      process.stdout.isTTY === true &&
      flags.yes !== true &&
      flags.json !== true &&
      flags.global !== true;
    const deps = interactive ? { prompter: createClackPrompter() } : {};
    const result = await runInit(
      process.cwd(),
      {
        yes: flags.yes === true,
        global: flags.global === true,
        lessons: flags.lessons === true,
      },
      deps,
    );
    // In interactive mode clack already rendered intro/summary/outro — skip renderInit.
    handleResult(
      'init',
      result,
      narrowFlags(flags),
      interactive ? () => {} : () => renderInit(result),
    );
  },
  import: async (flags, _args) => {
    void _args;
    const nf = narrowFlags(flags);
    const result = await runImport(nf);
    handleResult('import', result, nf, () => renderImport(result));
  },
  diff: async (flags, _args) => {
    void _args;
    const nf = narrowFlags(flags);
    const result = await runDiff(nf);
    handleResult('diff', result, nf, () => renderDiff(result));
  },
  lint: async (flags, _args) => {
    void _args;
    const nf = narrowFlags(flags);
    const result = await runLintCmd(nf);
    handleResult('lint', result, nf, () => renderLint(result));
  },
  check: async (flags, _args) => {
    void _args;
    const nf = narrowFlags(flags);
    const result = await runCheck(nf);
    handleResult('check', result, nf, () => renderCheck(result));
  },
  merge: async (flags, _args) => {
    void _args;
    const nf = narrowFlags(flags);
    const result = await runMerge(nf);
    handleResult('merge', result, nf, () => renderMerge(result));
  },
  matrix: async (flags, args) => {
    void args;
    const nf = narrowFlags(flags);
    const result = await runMatrix(nf);
    handleResult('matrix', result, nf, () =>
      renderMatrix(result, { verbose: nf.verbose === true }),
    );
  },
  watch: async (flags, _args) => {
    void _args;
    const nf = narrowFlags(flags);
    if (nf.json === true) {
      emitJson('watch', { success: false, error: '--json is not supported with watch' });
      process.exit(1);
      return;
    }
    const handle = await runWatch(nf);
    const stop = (): void => {
      void handle.stop().then(() => process.exit(0));
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  },
  install: async (flags, args) => {
    const nf = narrowFlags(flags);
    if (nf.json === true) nf.force = true;
    const result = await runInstall(nf, args, process.cwd());
    handleResult('install', result, nf, () => renderInstall(result));
  },
  uninstall: async (flags, args) => {
    const nf = narrowFlags(flags);
    if (nf.json === true) nf.force = true;
    const result = await runUninstall(nf, args, process.cwd());
    handleResult('uninstall', result, nf, () => renderUninstall(result));
  },
  refresh: async (flags, args) => {
    const nf = narrowFlags(flags);
    const result = await runRefresh(nf, args, process.cwd());
    handleResult('refresh', result, nf, () => renderRefresh(result));
  },
  installs: async (flags, args) => {
    const nf = narrowFlags(flags);
    const result = await runInstalls(nf, args, process.cwd());
    handleResult('installs', result, nf, () => renderInstalls(result));
  },
  plugin: async (flags, args) => {
    const nf = narrowFlags(flags);
    const result = await runPlugin(nf, args, process.cwd());
    handleResult('plugin', result, nf, () => renderPlugin(result));
  },
  target: async (flags, args) => {
    const nf = narrowFlags(flags);
    const result = await runTarget(nf, args, process.cwd());
    handleResult('target', result, nf, () => renderTarget(result));
  },
  convert: async (flags, _args) => {
    void _args;
    const nf = narrowFlags(flags);
    const result = await runConvert(nf);
    handleResult('convert', result, nf, () => renderConvert(result));
  },
  mcp: async (flags, args) => {
    await runMcp(narrowFlags(flags), args);
  },
  lessons: async (flags, args) => {
    // lessons is the only command that consumes repeated flags — pass the full
    // (possibly array-valued) flags through; handleResult only needs scalars.
    const result = await runLessons(flags, args, process.cwd());
    handleResult('lessons', result, narrowFlags(flags), () => renderLessons(result));
    if (result.exitCode !== 0) process.exit(result.exitCode);
  },
};
