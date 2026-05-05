import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRouter } from './router.js';
import { printHelp } from './help.js';
import { printVersion } from './version.js';
import { handleError } from './error-handler.js';
import { handleResult } from './json-handler.js';
import { emitJson } from './json-output.js';
import { logger, muteLogger } from '../utils/output/logger.js';
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

export interface ParseResult {
  command: string;
  flags: Record<string, string | boolean>;
  args: string[];
}

/**
 * Parses CLI arguments into command and flags.
 * @param argv - process.argv.slice(2)
 * @returns command name and flags object
 */
export function parseArgs(argv: string[]): ParseResult {
  const flags: Record<string, string | boolean> = {};
  const args: string[] = [];
  let command = 'help';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    // Global --version / --help only apply before the command token is seen
    if (command === 'help' && arg === '--version')
      return { command: 'version', flags: {}, args: [] };
    if (command === 'help' && arg === '--help') return { command: 'help', flags: {}, args: [] };
    if (arg.startsWith('--')) {
      const name = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[name] = true;
      } else {
        flags[name] = next;
        i++;
      }
      continue;
    }
    if (command === 'help') {
      command = arg;
    } else {
      args.push(arg);
    }
  }
  return { command, flags, args };
}

const CMDS = [
  'init',
  'generate',
  'import',
  'diff',
  'lint',
  'watch',
  'check',
  'merge',
  'matrix',
  'install',
  'plugin',
  'target',
] as const;

function stub(name: string) {
  return async (flags: Record<string, string | boolean>, _args: string[]) => {
    void flags;
    void _args;
    logger.info(`Not implemented yet: ${name}`);
  };
}

const cmdHandlers: Record<
  string,
  (flags: Record<string, string | boolean>, args: string[]) => Promise<void>
> = {
  ...Object.fromEntries(CMDS.map((c) => [c, stub(c)])),
  generate: async (flags, _args) => {
    void _args;
    const result = await runGenerate(flags);
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
    let result;
    try {
      result = await runPlugin(flags, args, process.cwd());
    } catch (err) {
      if (flags.json === true) {
        const msg = err instanceof Error ? err.message : String(err);
        emitJson('plugin', { success: false, error: msg });
        process.exit(2);
      }
      logger.error(err instanceof Error ? err.message : String(err));
      process.exit(2);
    }
    handleResult('plugin', result, flags, () => renderPlugin(result));
  },
  target: async (flags, args) => {
    let result;
    try {
      result = await runTarget(flags, args, process.cwd());
    } catch (err) {
      if (flags.json === true) {
        const msg = err instanceof Error ? err.message : String(err);
        emitJson('target', { success: false, error: msg });
        process.exit(2);
      }
      logger.error(err instanceof Error ? err.message : String(err));
      process.exit(2);
    }
    handleResult('target', result, flags, () => renderTarget(result));
  },
};
const router = createRouter(cmdHandlers);

async function main(parsed: ParseResult): Promise<void> {
  const { command, flags, args } = parsed;

  if (command === 'help') {
    printHelp();
    return;
  }
  if (command === 'version') {
    printVersion();
    return;
  }

  if (flags.json === true) muteLogger();

  await router.route(command, flags, args);
}

function isMainModule(): boolean {
  const invoked = process.argv[1];
  if (!invoked) return false;
  const ourPath = fileURLToPath(import.meta.url);
  try {
    const invokedResolved = resolve(process.cwd(), invoked);
    return invokedResolved === ourPath || realpathSync(invokedResolved) === realpathSync(ourPath);
  } catch {
    return invoked.endsWith('cli.js') || invoked.includes('agentsmesh');
  }
}

if (isMainModule()) {
  const parsed = parseArgs(process.argv.slice(2));
  main(parsed).catch((err) =>
    handleError(err instanceof Error ? err : new Error(String(err)), {
      verbose: parsed.flags.verbose === true,
      json: parsed.flags.json === true,
      command: parsed.command,
    }),
  );
}
