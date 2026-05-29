/**
 * Parse and validate install command flags.
 */

import { manualInstallAsSchema } from '../manual/manual-install-mode.js';

export interface InstallFlagsParsed {
  sync: boolean;
  dryRun: boolean;
  force: boolean;
  useExtends: boolean;
  all: boolean;
  forceFreshMaterialize: boolean;
  explicitPath?: string;
  explicitTarget?: string;
  explicitAs?: ReturnType<typeof manualInstallAsSchema.parse>;
  nameOverride: string;
  /**
   * Per-artifact consent for elevated install artifacts. Defaults to false
   * so a fresh `agentsmesh install github:foo/bar` never silently inherits
   * hooks/permissions/mcp from a third-party source. `acceptElevated` is a
   * convenience that sets all three.
   */
  acceptHooks: boolean;
  acceptPermissions: boolean;
  acceptMcp: boolean;
}

export function readInstallFlags(flags: Record<string, string | boolean>): InstallFlagsParsed {
  // Recursive `runInstall` calls (auto-pick, marketplace fan-out) build flag
  // bags with `?? ''` defaults. Treat empty strings (and whitespace-only
  // strings) as "not provided" so the contract everywhere downstream is
  // "undefined OR a non-empty value".
  const explicitPathRaw = typeof flags.path === 'string' ? flags.path.trim() : undefined;
  const explicitTargetRaw = typeof flags.target === 'string' ? flags.target.trim() : undefined;
  const explicitAsRaw = typeof flags.as === 'string' ? flags.as.trim() : undefined;
  const acceptElevated = flags['accept-elevated'] === true;
  return {
    sync: flags.sync === true,
    dryRun: flags['dry-run'] === true,
    force: flags.force === true,
    useExtends: flags.extends === true,
    all: flags.all === true,
    forceFreshMaterialize: flags.forceFreshMaterialize === true,
    explicitPath: explicitPathRaw ? explicitPathRaw : undefined,
    explicitTarget: explicitTargetRaw ? explicitTargetRaw : undefined,
    explicitAs: explicitAsRaw ? manualInstallAsSchema.parse(explicitAsRaw) : undefined,
    nameOverride: typeof flags.name === 'string' ? flags.name.trim() : '',
    acceptHooks: acceptElevated || flags['accept-hooks'] === true,
    acceptPermissions: acceptElevated || flags['accept-permissions'] === true,
    acceptMcp: acceptElevated || flags['accept-mcp'] === true,
  };
}
