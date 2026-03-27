/**
 * Parse and validate install command flags.
 */

import { manualInstallAsSchema } from '../manual/manual-install-mode.js';

export function readInstallFlags(flags: Record<string, string | boolean>): {
  sync: boolean;
  dryRun: boolean;
  force: boolean;
  useExtends: boolean;
  explicitPath?: string;
  explicitTarget?: string;
  explicitAs?: ReturnType<typeof manualInstallAsSchema.parse>;
  nameOverride: string;
} {
  return {
    sync: flags.sync === true,
    dryRun: flags['dry-run'] === true,
    force: flags.force === true,
    useExtends: flags.extends === true,
    explicitPath: typeof flags.path === 'string' ? flags.path : undefined,
    explicitTarget: typeof flags.target === 'string' ? flags.target.trim() : undefined,
    explicitAs:
      typeof flags.as === 'string' ? manualInstallAsSchema.parse(flags.as.trim()) : undefined,
    nameOverride: typeof flags.name === 'string' ? flags.name.trim() : '',
  };
}
