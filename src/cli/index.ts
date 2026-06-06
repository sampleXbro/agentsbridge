import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRouter } from './router.js';
import { printCommandHelp, printHelp } from './help.js';
import { printVersion } from './version.js';
import { handleError } from './error-handler.js';
import { muteLogger } from '../utils/output/logger.js';
import { cmdHandlers } from './command-handlers.js';

/** A parsed flag value: a string, a boolean (presence), or — when the flag is repeated — an array of its string values. */
export type CliFlagValue = string | boolean | string[];
export type CliFlags = Record<string, CliFlagValue>;

export interface ParseResult {
  command: string;
  flags: CliFlags;
  args: string[];
}

/** Accumulate repeated string flags into an array so `--x a --x b` yields `[a, b]` rather than dropping `a`. */
function setFlag(flags: CliFlags, name: string, value: string | boolean): void {
  const existing = flags[name];
  if (existing === undefined || typeof value === 'boolean') {
    flags[name] = value;
    return;
  }
  if (Array.isArray(existing)) existing.push(value);
  else if (typeof existing === 'string') flags[name] = [existing, value];
  else flags[name] = value;
}

/**
 * Parses CLI arguments into command and flags.
 * @param argv - process.argv.slice(2)
 * @returns command name and flags object
 */
export function parseArgs(argv: string[]): ParseResult {
  const flags: CliFlags = {};
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
        setFlag(flags, name, true);
      } else {
        setFlag(flags, name, next);
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
  if (flags.help === true) {
    printCommandHelp(command);
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
