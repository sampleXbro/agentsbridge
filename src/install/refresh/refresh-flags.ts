/**
 * Parse and validate `agentsmesh refresh` command flags.
 */

export interface RefreshFlags {
  readonly dryRun: boolean;
  readonly force: boolean;
  readonly global: boolean;
  readonly json: boolean;
  readonly verbose: boolean;
}

export function readRefreshFlags(flags: Record<string, string | boolean>): RefreshFlags {
  const json = flags.json === true;
  return {
    dryRun: flags['dry-run'] === true,
    force: flags.force === true || json,
    global: flags.global === true,
    json,
    verbose: flags.verbose === true,
  };
}

export function parseRefreshNames(args: readonly string[]): string[] {
  const out: string[] = [];
  for (const arg of args) {
    for (const part of arg
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)) {
      out.push(part);
    }
  }
  return out;
}
