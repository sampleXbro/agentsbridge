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
import { parseFrontmatter } from '../../utils/text/markdown.js';
import { serializeImportedRuleWithFallback } from '../import/import-metadata.js';
import { importFileDirectory } from '../import/import-orchestrator.js';
import { mapCursorAgentFile, mapCursorCommandFile, mapCursorRuleFile } from './importer-mappers.js';
import { importSettings, importIgnore } from './settings-helpers.js';
import { importSkills } from './skills-adapter.js';
import { importFromCursorGlobalExports } from './import-global-exports.js';
import {
  CURSOR_COMPAT_AGENTS,
  CURSOR_LEGACY_RULES,
  CURSOR_RULES_DIR,
  CURSOR_COMMANDS_DIR,
  CURSOR_AGENTS_DIR,
  CURSOR_MCP,
  CURSOR_CANONICAL_RULES_DIR,
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

  await importRules(projectRoot, results, normalize);
  await importCommands(projectRoot, results, normalize);
  await importAgents(projectRoot, results, normalize);
  await importSkills(projectRoot, results, normalize);
  await importMcp(projectRoot, results);
  await importSettings(projectRoot, results);
  await importIgnore(projectRoot, results);

  return results;
}

async function importRules(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const destDir = join(projectRoot, CURSOR_CANONICAL_RULES_DIR);
  let rootWritten = false;

  const rulesDir = join(projectRoot, CURSOR_RULES_DIR);
  results.push(
    ...(await importFileDirectory({
      srcDir: rulesDir,
      destDir,
      extensions: ['.mdc'],
      fromTool: 'cursor',
      normalize,
      mapEntry: async ({ srcPath, relativePath, normalizeTo }) => {
        // When root already written (from AGENTS.md), skip alwaysApply rules to avoid duplicate root
        if (rootWritten) {
          const raw = await readFileSafe(srcPath);
          if (raw !== null) {
            const { frontmatter } = parseFrontmatter(raw);
            if (frontmatter.alwaysApply === true) return null;
          }
        }
        return mapCursorRuleFile(relativePath, destDir, normalizeTo, () => {
          rootWritten = true;
        });
      },
    })),
  );

  if (!rootWritten) {
    const agentsPath = join(projectRoot, CURSOR_COMPAT_AGENTS);
    const agentsContent = await readFileSafe(agentsPath);
    if (agentsContent !== null) {
      rootWritten = true;
      await mkdirp(destDir);
      const destPath = join(destDir, '_root.md');
      const { frontmatter, body } = parseFrontmatter(
        normalize(agentsContent, agentsPath, destPath),
      );
      const hasRoot = frontmatter.root === true;
      const outFm = hasRoot ? frontmatter : { ...frontmatter, root: true };
      const outContent = await serializeImportedRuleWithFallback(destPath, outFm, body);
      await writeFileAtomic(destPath, outContent);
      results.push({
        fromTool: 'cursor',
        fromPath: agentsPath,
        toPath: `${CURSOR_CANONICAL_RULES_DIR}/_root.md`,
        feature: 'rules',
      });
    }
  }

  // Fallback: .cursorrules when no root rule was found from AGENTS.md or alwaysApply:.mdc
  if (!rootWritten) {
    const cursorRulesPath = join(projectRoot, CURSOR_LEGACY_RULES);
    const cursorRulesContent = await readFileSafe(cursorRulesPath);
    if (cursorRulesContent !== null) {
      await mkdirp(destDir);
      const destPath = join(destDir, '_root.md');
      const { frontmatter, body } = parseFrontmatter(
        normalize(cursorRulesContent, cursorRulesPath, destPath),
      );
      const outFm = { ...frontmatter, root: true };
      const outContent = await serializeImportedRuleWithFallback(destPath, outFm, body);
      await writeFileAtomic(destPath, outContent);
      results.push({
        fromTool: 'cursor',
        fromPath: cursorRulesPath,
        toPath: `${CURSOR_CANONICAL_RULES_DIR}/_root.md`,
        feature: 'rules',
      });
    }
  }
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
