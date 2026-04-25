/**
 * Plugin bootstrap: load all configured plugins at command startup.
 * Call this once after config load and before target iteration.
 */

import { loadAllPlugins } from './load-plugin.js';
import type { ValidatedConfig } from '../config/core/schema.js';

/**
 * Load all plugins declared in config.plugins and register their descriptors.
 * Failing plugins are skipped with a warning (see load-plugin.ts).
 */
export async function bootstrapPlugins(
  config: ValidatedConfig,
  projectRoot: string,
): Promise<void> {
  if (config.plugins.length === 0) return;
  await loadAllPlugins(config.plugins, projectRoot);
}
