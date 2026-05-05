export interface HelpFlag {
  name: string;
  description: string;
}

export interface HelpCommand {
  name: string;
  usage: string;
  description: string;
  flags: HelpFlag[];
}

export const GLOBAL_FLAGS: HelpFlag[] = [
  { name: '--help', description: 'Show this help output and exit' },
  { name: '--version', description: 'Print CLI version and exit' },
  { name: '--verbose', description: 'Show full error details on failure' },
  { name: '--json', description: 'Output machine-readable JSON (single envelope to stdout)' },
];

export const COMMANDS: HelpCommand[] = [
  {
    name: 'init',
    usage: 'agentsmesh init [flags]',
    description:
      'Create agentsmesh.yaml, agentsmesh.local.yaml, and canonical .agentsmesh scaffold',
    flags: [
      {
        name: '--global',
        description:
          'Initialize canonical home config under ~/.agentsmesh/ (global targets include claude-code, antigravity, codex-cli, cursor, gemini-cli, kilo-code)',
      },
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
      {
        name: '--global',
        description:
          'Generate user-level config from ~/.agentsmesh/ (e.g. claude-code, antigravity, codex-cli, gemini-cli, kilo-code; Cursor writes ~/.cursor/rules, ~/.cursor/AGENTS.md, hooks, ignore, MCP, skills, agents, commands; legacy ~/.agentsmesh-exports/cursor/user-rules.md is import-only)',
      },
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
    usage: 'agentsmesh import --from <target> [flags]',
    description: 'Import existing tool config into canonical .agentsmesh files',
    flags: [
      { name: '--from <target>', description: 'Source tool ID to import from (required)' },
      {
        name: '--global',
        description:
          'Import from user-level paths into ~/.agentsmesh/ (claude-code, antigravity, codex-cli, gemini-cli, kilo-code; cursor reads ~/.cursor/{rules,AGENTS.md,mcp.json,hooks.json,cursorignore,skills,agents,commands} and legacy ~/.agentsmesh-exports/cursor/user-rules.md)',
      },
    ],
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
        name: '--global',
        description: 'Install into ~/.agentsmesh/ and regenerate user-level config',
      },
      {
        name: '--force',
        description:
          'Non-interactive mode; include invalid resources and skip selection prompts (implied by --json)',
      },
    ],
  },
  {
    name: 'diff',
    usage: 'agentsmesh diff [flags]',
    description: 'Show patch-style output for what generate would change',
    flags: [
      { name: '--global', description: 'Diff against outputs generated from ~/.agentsmesh/' },
      { name: '--targets <csv>', description: 'Limit diff to target IDs (comma-separated)' },
    ],
  },
  {
    name: 'lint',
    usage: 'agentsmesh lint [flags]',
    description: 'Validate canonical files against target constraints',
    flags: [
      { name: '--global', description: 'Lint canonical home config under ~/.agentsmesh/' },
      { name: '--targets <csv>', description: 'Limit linting to target IDs (comma-separated)' },
    ],
  },
  {
    name: 'watch',
    usage: 'agentsmesh watch [flags]',
    description: 'Watch canonical files and regenerate on change',
    flags: [
      {
        name: '--global',
        description: 'Watch ~/.agentsmesh/ and regenerate user-level config',
      },
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
    flags: [{ name: '--global', description: 'Check ~/.agentsmesh/.lock' }],
  },
  {
    name: 'merge',
    usage: 'agentsmesh merge',
    description: 'Resolve .agentsmesh/.lock merge conflicts from current canonical state',
    flags: [{ name: '--global', description: 'Resolve ~/.agentsmesh/.lock conflicts' }],
  },
  {
    name: 'matrix',
    usage: 'agentsmesh matrix [flags]',
    description: 'Print compatibility matrix for enabled features and targets',
    flags: [
      {
        name: '--global',
        description: 'Show matrix for canonical home config under ~/.agentsmesh/',
      },
      { name: '--targets <csv>', description: 'Limit matrix columns to target IDs' },
      { name: '--verbose', description: 'Include expanded feature details in matrix output' },
    ],
  },
  {
    name: 'target',
    usage: 'agentsmesh target scaffold <id> [--name <displayName>] [--force]',
    description: 'Generate a new target skeleton (files, tests, fixture) under src/targets/<id>/.',
    flags: [
      { name: '--name <displayName>', description: 'Human-readable name (defaults to id)' },
      { name: '--force', description: 'Overwrite existing files' },
    ],
  },
  {
    name: 'plugin',
    usage: 'agentsmesh plugin <add|list|remove|info> [args] [flags]',
    description: 'Manage plugin-provided targets (npm packages exporting a TargetDescriptor).',
    flags: [
      { name: '--version <v>', description: 'Pin plugin version (add)' },
      { name: '--id <id>', description: 'Override derived plugin id (add)' },
    ],
  },
];
