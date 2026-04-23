import { logger } from '../utils/output/logger.js';
import { COMMANDS, GLOBAL_FLAGS, type HelpFlag } from './help-data.js';

function formatFlags(flags: HelpFlag[], pad = 18): string {
  if (flags.length === 0) return '  (no command-specific flags)';
  return flags.map((flag) => `  ${flag.name.padEnd(pad)}${flag.description}`).join('\n');
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
 * Prints help for a specific command.
 */
export function printCommandHelp(command: string): void {
  const match = COMMANDS.find((item) => item.name === command);
  if (!match) {
    printHelp();
    return;
  }

  logger.info(`${match.usage}

${match.description}

Command flags:
${formatFlags(match.flags)}

Global flags:
${formatFlags(GLOBAL_FLAGS)}`);
}
