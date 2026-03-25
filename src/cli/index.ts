import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRouter } from './router.js';
import { printHelp } from './help.js';
import { printVersion } from './version.js';
import { handleError } from './error-handler.js';
import { logger } from '../utils/logger.js';
import { runGenerate } from './commands/generate.js';
import { runInit } from './commands/init.js';
import { runImport } from './commands/import.js';
import { runDiff } from './commands/diff.js';
import { runLintCmd } from './commands/lint.js';
import { runMatrix } from './commands/matrix.js';
import { runWatch } from './commands/watch.js';
import { runCheck } from './commands/check.js';
import { runMerge } from './commands/merge.js';
import { runInstall } from './commands/install.js';

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
    if (arg === '--version') return { command: 'version', flags: {}, args: [] };
    if (arg === '--help') return { command: 'help', flags: {}, args: [] };
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
    const code = await runGenerate(flags);
    if (code !== 0) process.exit(code);
  },
  init: async (flags, _args) => {
    void _args;
    await runInit(process.cwd(), { yes: flags.yes === true });
  },
  import: (flags, _args) => {
    void _args;
    return runImport(flags);
  },
  diff: (flags, _args) => {
    void _args;
    return runDiff(flags);
  },
  lint: async (flags, _args) => {
    void _args;
    const code = await runLintCmd(flags);
    if (code !== 0) process.exit(code);
  },
  check: async (flags, _args) => {
    void _args;
    const code = await runCheck(flags);
    if (code !== 0) process.exit(code);
  },
  merge: (flags, _args) => {
    void _args;
    return runMerge(flags);
  },
  matrix: (flags, args) => {
    void args;
    return runMatrix(flags);
  },
  watch: async (flags, _args) => {
    void _args;
    const handle = await runWatch(flags);
    const stop = (): void => {
      void handle.stop().then(() => process.exit(0));
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  },
  install: (flags, args) => runInstall(flags, args, process.cwd()),
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
    return invoked.endsWith('cli.js') || invoked.includes('agentsbridge');
  }
}

if (isMainModule()) {
  const parsed = parseArgs(process.argv.slice(2));
  main(parsed).catch((err) =>
    handleError(err instanceof Error ? err : new Error(String(err)), {
      verbose: parsed.flags.verbose === true,
    }),
  );
}
