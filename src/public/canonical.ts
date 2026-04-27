/**
 * Public API — canonical loading (package.json "exports"."./canonical").
 */

import type { CanonicalFiles } from '../core/types.js';
import type { ValidatedConfig } from '../config/core/schema.js';
import { ConfigNotFoundError } from '../core/errors.js';
import { loadCanonicalWithExtends } from '../canonical/extends/extends.js';
import { loadCanonicalFiles } from '../canonical/load/loader.js';
import { loadConfigFromDir } from '../config/core/loader.js';

export { loadCanonicalFiles };

export type {
  CanonicalFiles,
  CanonicalRule,
  CanonicalCommand,
  CanonicalAgent,
  CanonicalSkill,
  SkillSupportingFile,
  Permissions,
  IgnorePatterns,
} from '../core/canonical-types.js';

export type { McpServer, StdioMcpServer, UrlMcpServer, McpConfig } from '../core/mcp-types.js';

export type { Hooks, HookEntry } from '../core/hook-types.js';

export interface LoadCanonicalOptions {
  /** Preloaded config. Must be provided together with `configDir`. */
  readonly config?: ValidatedConfig;
  /** Directory containing `agentsmesh.yaml`. Must be provided together with `config`. */
  readonly configDir?: string;
  /** Override canonical directory; defaults to `<configDir>/.agentsmesh`. */
  readonly canonicalDir?: string;
  /** Defaults to true when config is available. Set false for local-only `.agentsmesh/`. */
  readonly includeExtends?: boolean;
  /** Refresh remote extend cache before loading. */
  readonly refreshRemoteCache?: boolean;
}

/**
 * Load canonical content for a project. When an `agentsmesh.yaml` can be found,
 * this mirrors CLI generation by merging extends and installed packs before
 * local `.agentsmesh/` content. Use `loadCanonicalFiles()` for local-only reads.
 */
export async function loadCanonical(
  projectRoot: string,
  options: LoadCanonicalOptions = {},
): Promise<CanonicalFiles> {
  if (options.includeExtends === false) {
    return loadCanonicalFiles(options.canonicalDir ?? projectRoot);
  }

  if (
    (options.config === undefined && options.configDir !== undefined) ||
    (options.config !== undefined && options.configDir === undefined)
  ) {
    throw new Error('loadCanonical options require both config and configDir, or neither.');
  }

  try {
    const loaded =
      options.config !== undefined && options.configDir !== undefined
        ? { config: options.config, configDir: options.configDir }
        : await loadConfigFromDir(projectRoot);
    const { canonical } = await loadCanonicalWithExtends(
      loaded.config,
      loaded.configDir,
      { refreshRemoteCache: options.refreshRemoteCache === true },
      options.canonicalDir,
    );
    return canonical;
  } catch (err) {
    if (
      err instanceof ConfigNotFoundError &&
      options.config === undefined &&
      options.configDir === undefined
    ) {
      return loadCanonicalFiles(options.canonicalDir ?? projectRoot);
    }
    throw err;
  }
}
