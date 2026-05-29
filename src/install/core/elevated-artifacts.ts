/**
 * Consent gate for "elevated" install artifacts: `hooks`, `permissions`,
 * and `mcp`. These three control the user's tool settings at generate time
 * (e.g. Claude Code `settings.json` hooks → shell commands, MCP server
 * launch specs → spawned child processes). A third-party pack that ships
 * any of them effectively gets local code execution on the user's machine
 * the next time the target agent triggers the matching event.
 *
 * For non-local sources the default is **strip**. The user has to opt in
 * per-artifact (`--accept-hooks`, `--accept-permissions`, `--accept-mcp`)
 * or to all three (`--accept-elevated`). Local sources are trusted as-is
 * because the user already controls those bytes.
 */

import type { CanonicalFiles } from '../../core/types.js';
import type { InstallSourceKind } from '../source/install-source-types.js';

export type ElevatedArtifact = 'hooks' | 'permissions' | 'mcp';

export interface ElevatedArtifactGateOptions {
  readonly sourceKind: InstallSourceKind;
  readonly acceptHooks: boolean;
  readonly acceptPermissions: boolean;
  readonly acceptMcp: boolean;
}

export interface ElevatedArtifactGateResult {
  readonly canonical: CanonicalFiles;
  /** Names of elevated artifacts that were nulled out by the gate. */
  readonly stripped: ElevatedArtifact[];
}

export function stripUntrustedElevatedArtifacts(
  canonical: CanonicalFiles,
  options: ElevatedArtifactGateOptions,
): ElevatedArtifactGateResult {
  if (options.sourceKind === 'local') {
    return { canonical, stripped: [] };
  }

  const stripped: ElevatedArtifact[] = [];
  let hooks = canonical.hooks;
  let permissions = canonical.permissions;
  let mcp = canonical.mcp;

  if (hooks !== null && !options.acceptHooks) {
    hooks = null;
    stripped.push('hooks');
  }
  if (permissions !== null && !options.acceptPermissions) {
    permissions = null;
    stripped.push('permissions');
  }
  if (mcp !== null && !options.acceptMcp) {
    mcp = null;
    stripped.push('mcp');
  }

  if (stripped.length === 0) {
    return { canonical, stripped: [] };
  }

  return {
    canonical: { ...canonical, hooks, permissions, mcp },
    stripped,
  };
}
