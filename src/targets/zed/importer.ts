/**
 * Import Zed config into canonical `.agentsmesh/`.
 *
 * Reads:
 *   - `.rules` / `~/.config/zed/AGENTS.md`  — root rule plus the embedded
 *                                             non-root rules split back out
 *   - `.agents/skills/`                     — skills, and commands projected as skills
 *   - `settings.json`                       — MCP servers, ignore globs, and
 *                                             (global only) agent tool permissions
 */

import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { importEmbeddedSkills } from '../import/embedded-skill.js';
import { importZedMcp } from './mcp-import.js';
import { importZedRules } from './rules-import.js';
import { importZedSettingsFeatures } from './settings-import.js';
import {
  ZED_TARGET,
  ZED_SETTINGS_FILE,
  ZED_SKILLS_DIR,
  ZED_GLOBAL_SKILLS_DIR,
  ZED_GLOBAL_SETTINGS_FILE,
} from './constants.js';

export async function importFromZed(
  projectRoot: string,
  options: { scope?: TargetLayoutScope } = {},
): Promise<ImportResult[]> {
  const scope = options.scope ?? 'project';
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(ZED_TARGET, projectRoot, scope);

  await importZedRules(projectRoot, scope, results, normalize);

  const skillsDir = scope === 'global' ? ZED_GLOBAL_SKILLS_DIR : ZED_SKILLS_DIR;
  await importEmbeddedSkills(projectRoot, skillsDir, ZED_TARGET, results, normalize);

  const settingsFile = scope === 'global' ? ZED_GLOBAL_SETTINGS_FILE : ZED_SETTINGS_FILE;
  await importZedMcp(projectRoot, settingsFile, results);
  await importZedSettingsFeatures(projectRoot, settingsFile, scope, results);

  return results;
}
