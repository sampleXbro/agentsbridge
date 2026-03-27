/**
 * Lint engine: validates canonical files against target constraints.
 */

import { relative } from 'node:path';
import type { CanonicalFiles, LintDiagnostic } from '../types.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import { readDirRecursive } from '../../utils/filesystem/fs.js';
import { lintCommands } from './commands.js';
import { lintMcp } from './mcp.js';
import { lintPermissions } from './permissions.js';
import { lintHooks } from './hooks.js';
import { getTargetCatalogEntry, isBuiltinTargetId } from '../../targets/catalog/target-catalog.js';

const EXCLUDE_DIRS = ['node_modules', '.git', 'dist', 'coverage', '.agentsmesh'];

/**
 * Get project file paths relative to projectRoot, excluding common dirs.
 */
async function getProjectFiles(projectRoot: string): Promise<string[]> {
  const all = await readDirRecursive(projectRoot);
  const filtered = all.filter((p) => {
    const rel = relative(projectRoot, p);
    return !EXCLUDE_DIRS.some((d) => rel.includes(`/${d}/`) || rel.startsWith(`${d}/`));
  });
  return filtered.map((p) => relative(projectRoot, p));
}

/**
 * Run lint across all enabled targets.
 * @param config - Validated config
 * @param canonical - Loaded canonical files
 * @param projectRoot - Project root (for glob matching)
 * @param targetFilter - Optional target filter (e.g. from --targets)
 * @returns All diagnostics, and whether any are errors
 */
export async function runLint(
  config: ValidatedConfig,
  canonical: CanonicalFiles,
  projectRoot: string,
  targetFilter?: string[],
): Promise<{ diagnostics: LintDiagnostic[]; hasErrors: boolean }> {
  const targets = targetFilter
    ? config.targets.filter((t) => targetFilter.includes(t))
    : config.targets;
  const hasRules = config.features.includes('rules');
  const hasCommands = config.features.includes('commands');
  const hasMcp = config.features.includes('mcp');
  const hasPermissions = config.features.includes('permissions');
  const hasHooks = config.features.includes('hooks');

  const diagnostics: LintDiagnostic[] = [];
  const projectFiles = await getProjectFiles(projectRoot);

  for (const target of targets) {
    const linter = isBuiltinTargetId(target) ? getTargetCatalogEntry(target).lintRules : null;
    if (hasRules && linter) {
      diagnostics.push(...linter(canonical, projectRoot, projectFiles));
    }
    if (hasCommands) {
      diagnostics.push(...lintCommands(canonical, target));
    }
    if (hasMcp) {
      diagnostics.push(...lintMcp(canonical, target));
    }
    if (hasPermissions) {
      diagnostics.push(...lintPermissions(canonical, target));
    }
    if (hasHooks) {
      diagnostics.push(...lintHooks(canonical, target));
    }
  }

  const hasErrors = diagnostics.some((d) => d.level === 'error');
  return { diagnostics, hasErrors };
}
