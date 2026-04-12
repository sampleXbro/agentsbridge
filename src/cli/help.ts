import { logger } from '../utils/output/logger.js';

interface HelpFlag {
  name: string;
  description: string;
}

interface HelpCommand {
  name: string;
  usage: string;
  description: string;
  flags: HelpFlag[];
}

const GLOBAL_FLAGS: HelpFlag[] = [
  { name: '--help', description: 'Show this help output and exit' },
  { name: '--version', description: 'Print CLI version and exit' },
  { name: '--verbose', description: 'Show full error details on failure' },
];

const COMMANDS: HelpCommand[] = [
  {
    name: 'init',
    usage: 'agentsmesh init [flags]',
    description:
      'Create agentsmesh.yaml, agentsmesh.local.yaml, and canonical .agentsmesh scaffold',
    flags: [
      {
        name: '--yes',
        description:
          'Auto-import detected tool configs, then add example scaffold only under empty canonical paths',
      },
    ],
  },
  {
    name: 'generate',
    usage: 'agentsmesh generate [flags]',
    description: 'Generate target files from canonical sources',
    flags: [
      { name: '--targets <csv>', description: 'Limit generation to target IDs (comma-separated)' },
      { name: '--check', description: 'Check drift only; exit non-zero when out of sync' },
      { name: '--dry-run', description: 'Preview file changes without writing outputs' },
      { name: '--force', description: 'Bypass lock-strategy blocked feature violations' },
      { name: '--refresh-cache', description: 'Refresh remote extends cache before loading' },
      { name: '--no-cache', description: 'Alias for --refresh-cache' },
    ],
  },
  {
    name: 'import',
    usage: 'agentsmesh import --from <target>',
    description: 'Import existing tool config into canonical .agentsmesh files',
    flags: [{ name: '--from <target>', description: 'Source tool ID to import from (required)' }],
  },
  {
    name: 'install',
    usage: 'agentsmesh install <source> [flags]',
    description: 'Install canonical resources from local/remote sources',
    flags: [
      {
        name: '<source>',
        description: 'GitHub/GitLab/tree/blob URL, git+ URL, SSH, or local path',
      },
      {
        name: '--sync',
        description: 'Reinstall missing packs recorded in .agentsmesh/installs.yaml',
      },
      {
        name: '--path <dir>',
        description: 'Subdirectory inside source repo when not embedded in URL',
      },
      {
        name: '--target <id>',
        description: 'Native format used for import-at-root discovery (same as extends.target)',
      },
      {
        name: '--as <kind>',
        description: 'Manual collection mode: rules, commands, agents, or skills',
      },
      { name: '--name <id>', description: 'Override generated install entry/pack name' },
      {
        name: '--extends',
        description: 'Write install as extends entry instead of materialized pack',
      },
      {
        name: '--dry-run',
        description: 'Preview only (no YAML write, no pack write, no generate)',
      },
      {
        name: '--force',
        description: 'Non-interactive mode; include invalid resources and skip selection prompts',
      },
    ],
  },
  {
    name: 'diff',
    usage: 'agentsmesh diff [flags]',
    description: 'Show patch-style output for what generate would change',
    flags: [{ name: '--targets <csv>', description: 'Limit diff to target IDs (comma-separated)' }],
  },
  {
    name: 'lint',
    usage: 'agentsmesh lint [flags]',
    description: 'Validate canonical files against target constraints',
    flags: [
      { name: '--targets <csv>', description: 'Limit linting to target IDs (comma-separated)' },
    ],
  },
  {
    name: 'watch',
    usage: 'agentsmesh watch [flags]',
    description: 'Watch canonical files and regenerate on change',
    flags: [
      {
        name: '--targets <csv>',
        description: 'Limit watched generate/matrix output to target IDs',
      },
    ],
  },
  {
    name: 'check',
    usage: 'agentsmesh check',
    description: 'Verify canonical files still match .agentsmesh/.lock',
    flags: [],
  },
  {
    name: 'merge',
    usage: 'agentsmesh merge',
    description: 'Resolve .agentsmesh/.lock merge conflicts from current canonical state',
    flags: [],
  },
  {
    name: 'matrix',
    usage: 'agentsmesh matrix [flags]',
    description: 'Print compatibility matrix for enabled features and targets',
    flags: [
      { name: '--targets <csv>', description: 'Limit matrix columns to target IDs' },
      { name: '--verbose', description: 'Include expanded feature details in matrix output' },
    ],
  },
];

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
