import { logger } from '../utils/output/logger.js';
import { COMMANDS, GLOBAL_FLAGS, type HelpCommand, type HelpFlag } from './help-data.js';
import { LESSONS_USAGE } from './commands/lessons-usage.js';

function formatFlags(flags: HelpFlag[], pad = 18): string {
  if (flags.length === 0) return '  (no command-specific flags)';
  // Widen the name column to the longest flag so names never collide with
  // their descriptions; always leave a ≥2-space gap.
  const width = Math.max(pad, ...flags.map((flag) => flag.name.length + 2));
  return flags.map((flag) => `  ${flag.name.padEnd(width)}${flag.description}`).join('\n');
}

/**
 * Prints main help text.
 */
export function printHelp(): void {
  const commandLines = COMMANDS.map((command) => {
    return `- ${command.name.padEnd(8)} ${command.description}\n  Usage: ${command.usage}\n${formatFlags(command.flags)}`;
  }).join('\n\n');

  logger.info(`agentsmesh <command> [flags]

Global flags:
${formatFlags(GLOBAL_FLAGS)}

Commands:
${commandLines}

Tip: run "agentsmesh <command> --help" for this same command reference.`);
}

/**
 * Prints help for a specific command. When `args[0]` names a `lessons`
 * subcommand, the view narrows to that subcommand's flags + a worked example
 * (so `lessons add --help` no longer dumps every subcommand's flags at once).
 */
export function printCommandHelp(command: string, args: string[] = []): void {
  const match = COMMANDS.find((item) => item.name === command);
  if (!match) {
    printHelp();
    return;
  }

  const sub = args[0];
  if (command === 'lessons' && sub !== undefined && sub.length > 0) {
    printLessonsSubcommandHelp(match, sub);
    return;
  }

  logger.info(`${match.usage}

${match.description}

Command flags:
${formatFlags(match.flags)}

Global flags:
${formatFlags(GLOBAL_FLAGS)}`);
}

/**
 * Focused help for a single `lessons` subcommand. Reuses the combined flag list
 * by filtering on the `"<sub>:"` description prefix already carried in
 * help-data, strips that prefix for a clean read, and appends the shared worked
 * example so capture/recall calls are one-shot correct.
 */
function printLessonsSubcommandHelp(lessons: HelpCommand, sub: string): void {
  const subFlags: HelpFlag[] = lessons.flags
    .filter((flag) => flag.description.startsWith(`${sub}:`))
    .map((flag) => ({
      name: flag.name,
      description: flag.description.slice(sub.length + 1).trim(),
    }));
  const usage = LESSONS_USAGE[sub];
  // No-argument subcommands (topics / journal / validate) carry a signature but
  // no worked example — render the Example block only when one exists.
  const example = usage?.example !== undefined ? `\n\nExample:\n  ${usage.example}` : '';

  logger.info(`${usage?.usage ?? `agentsmesh lessons ${sub} [flags]`}

Command flags:
${formatFlags(subFlags)}

Global flags:
${formatFlags(GLOBAL_FLAGS)}${example}`);
}
