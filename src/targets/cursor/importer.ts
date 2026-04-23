/**
 * Cursor target importer — full fidelity import into canonical .agentsmesh/.
 *
 * Sources imported:
 *   AGENTS.md                    → .agentsmesh/rules/_root.md
 *   .cursor/rules/*.mdc          → .agentsmesh/rules/*.md (alwaysApply → root)
 *   .cursor/commands/*.md        → .agentsmesh/commands/*.md
 *   .cursor/agents/*.md          → .agentsmesh/agents/*.md
 *   .cursor/skills/*.md          → .agentsmesh/skills/{name}/SKILL.md (flat → dir)
 *   .cursor/mcp.json             → .agentsmesh/mcp.json
 *   .cursor/hooks.json           → .agentsmesh/hooks.yaml (hooks)
 *   .cursor/settings.json        → .agentsmesh/permissions.yaml (permissions)
 *   .cursorignore                → .agentsmesh/ignore
 */

import { join, dirname } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { readFileSafe, writeFileAtomic, mkdirp } from '../../utils/filesystem/fs.js';
import { importFileDirectory } from '../import/import-orchestrator.js';
import { mapCursorAgentFile, mapCursorCommandFile } from './importer-mappers.js';
import { importCursorRules } from './importer-rules.js';
import { importSettings, importIgnore } from './settings-helpers.js';
import { importSkills } from './skills-adapter.js';
import { importFromCursorGlobalExports } from './import-global-exports.js';
import {
  CURSOR_COMMANDS_DIR,
  CURSOR_AGENTS_DIR,
  CURSOR_MCP,
  CURSOR_CANONICAL_COMMANDS_DIR,
  CURSOR_CANONICAL_AGENTS_DIR,
  CURSOR_CANONICAL_MCP,
} from './constants.js';

/**
 * Import Cursor config into canonical .agentsmesh/.
 * @param projectRoot - Project root directory
 * @returns Import results for each imported file
 */
export async function importFromCursor(
  projectRoot: string,
  options: { scope?: TargetLayoutScope } = {},
): Promise<ImportResult[]> {
  if (options.scope === 'global') {
    return importFromCursorGlobalExports(projectRoot);
  }
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer('cursor', projectRoot);

  await importCursorRules(projectRoot, results, normalize);
  await importCommands(projectRoot, results, normalize);
  await importAgents(projectRoot, results, normalize);
  await importSkills(projectRoot, results, normalize);
  await importMcp(projectRoot, results);
  await importSettings(projectRoot, results);
  await importIgnore(projectRoot, results);

  return results;
}

async function importCommands(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const destDir = join(projectRoot, CURSOR_CANONICAL_COMMANDS_DIR);
  const commandsDir = join(projectRoot, CURSOR_COMMANDS_DIR);
  results.push(
    ...(await importFileDirectory({
      srcDir: commandsDir,
      destDir,
      extensions: ['.md'],
      fromTool: 'cursor',
      normalize,
      mapEntry: ({ relativePath, normalizeTo }) =>
        mapCursorCommandFile(relativePath, destDir, normalizeTo),
    })),
  );
}

async function importAgents(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const destDir = join(projectRoot, CURSOR_CANONICAL_AGENTS_DIR);
  const agentsDir = join(projectRoot, CURSOR_AGENTS_DIR);
  results.push(
    ...(await importFileDirectory({
      srcDir: agentsDir,
      destDir,
      extensions: ['.md'],
      fromTool: 'cursor',
      normalize,
      mapEntry: ({ relativePath, normalizeTo }) =>
        mapCursorAgentFile(relativePath, destDir, normalizeTo),
    })),
  );
}

async function importMcp(projectRoot: string, results: ImportResult[]): Promise<void> {
  const mcpPath = join(projectRoot, CURSOR_MCP);
  const content = await readFileSafe(mcpPath);
  if (!content) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return;
  }
  if (!parsed || typeof parsed !== 'object' || !('mcpServers' in (parsed as object))) return;
  const destPath = join(projectRoot, CURSOR_CANONICAL_MCP);
  await mkdirp(dirname(destPath));
  await writeFileAtomic(destPath, content);
  results.push({
    fromTool: 'cursor',
    fromPath: mcpPath,
    toPath: CURSOR_CANONICAL_MCP,
    feature: 'mcp',
  });
}
