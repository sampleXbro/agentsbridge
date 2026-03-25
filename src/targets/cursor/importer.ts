/**
 * Cursor target importer — full fidelity import into canonical .agentsbridge/.
 *
 * Sources imported:
 *   AGENTS.md                    → .agentsbridge/rules/_root.md
 *   .cursor/rules/*.mdc          → .agentsbridge/rules/*.md (alwaysApply → root)
 *   .cursor/commands/*.md        → .agentsbridge/commands/*.md
 *   .cursor/agents/*.md          → .agentsbridge/agents/*.md
 *   .cursor/skills/*.md          → .agentsbridge/skills/{name}/SKILL.md (flat → dir)
 *   .cursor/mcp.json             → .agentsbridge/mcp.json
 *   .cursor/hooks.json           → .agentsbridge/hooks.yaml (hooks)
 *   .cursor/settings.json        → .agentsbridge/permissions.yaml (permissions)
 *   .cursorignore                → .agentsbridge/ignore
 */

import { join, dirname } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import { createImportReferenceNormalizer } from '../../core/import-reference-rewriter.js';
import { readFileSafe, writeFileAtomic, mkdirp } from '../../utils/fs.js';
import { parseFrontmatter } from '../../utils/markdown.js';
import { serializeImportedRuleWithFallback } from '../import-metadata.js';
import { importFileDirectory } from '../import-orchestrator.js';
import { mapCursorAgentFile, mapCursorCommandFile, mapCursorRuleFile } from './importer-mappers.js';
import { importSettings, importIgnore } from './settings-helpers.js';
import { importSkills } from './skills-helpers.js';

const AGENTS_MD = 'AGENTS.md';
const CURSORRULES = '.cursorrules';
const CURSOR_RULES_DIR = '.cursor/rules';
const CURSOR_COMMANDS_DIR = '.cursor/commands';
const CURSOR_AGENTS_DIR = '.cursor/agents';
const CURSOR_MCP = '.cursor/mcp.json';

const AB_RULES = '.agentsbridge/rules';
const AB_COMMANDS = '.agentsbridge/commands';
const AB_AGENTS = '.agentsbridge/agents';
const AB_MCP = '.agentsbridge/mcp.json';

/**
 * Import Cursor config into canonical .agentsbridge/.
 * @param projectRoot - Project root directory
 * @returns Import results for each imported file
 */
export async function importFromCursor(projectRoot: string): Promise<ImportResult[]> {
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
  const destDir = join(projectRoot, AB_RULES);
  let rootWritten = false;

  const agentsPath = join(projectRoot, AGENTS_MD);
  const agentsContent = await readFileSafe(agentsPath);
  if (agentsContent !== null) {
    rootWritten = true;
    await mkdirp(destDir);
    const destPath = join(destDir, '_root.md');
    const { frontmatter, body } = parseFrontmatter(normalize(agentsContent, agentsPath, destPath));
    const hasRoot = frontmatter.root === true;
    const outFm = hasRoot ? frontmatter : { ...frontmatter, root: true };
    const outContent = await serializeImportedRuleWithFallback(destPath, outFm, body);
    await writeFileAtomic(destPath, outContent);
    results.push({
      fromTool: 'cursor',
      fromPath: agentsPath,
      toPath: `${AB_RULES}/_root.md`,
      feature: 'rules',
    });
  }

  const rulesDir = join(projectRoot, CURSOR_RULES_DIR);
  results.push(
    ...(await importFileDirectory({
      srcDir: rulesDir,
      destDir,
      extensions: ['.mdc'],
      fromTool: 'cursor',
      normalize,
      mapEntry: async ({ srcPath, normalizeTo }) => {
        // When root already written (from AGENTS.md), skip alwaysApply rules to avoid duplicate root
        if (rootWritten) {
          const raw = await readFileSafe(srcPath);
          if (raw !== null) {
            const { frontmatter } = parseFrontmatter(raw);
            if (frontmatter.alwaysApply === true) return null;
          }
        }
        return mapCursorRuleFile(srcPath, destDir, normalizeTo, () => {
          rootWritten = true;
        });
      },
    })),
  );

  // Fallback: .cursorrules when no root rule was found from AGENTS.md or alwaysApply:.mdc
  if (!rootWritten) {
    const cursorRulesPath = join(projectRoot, CURSORRULES);
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
        toPath: `${AB_RULES}/_root.md`,
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
  const destDir = join(projectRoot, AB_COMMANDS);
  const commandsDir = join(projectRoot, CURSOR_COMMANDS_DIR);
  results.push(
    ...(await importFileDirectory({
      srcDir: commandsDir,
      destDir,
      extensions: ['.md'],
      fromTool: 'cursor',
      normalize,
      mapEntry: ({ srcPath, normalizeTo }) => mapCursorCommandFile(srcPath, destDir, normalizeTo),
    })),
  );
}

async function importAgents(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const destDir = join(projectRoot, AB_AGENTS);
  const agentsDir = join(projectRoot, CURSOR_AGENTS_DIR);
  results.push(
    ...(await importFileDirectory({
      srcDir: agentsDir,
      destDir,
      extensions: ['.md'],
      fromTool: 'cursor',
      normalize,
      mapEntry: ({ srcPath, normalizeTo }) => mapCursorAgentFile(srcPath, destDir, normalizeTo),
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
  const destPath = join(projectRoot, AB_MCP);
  await mkdirp(dirname(destPath));
  await writeFileAtomic(destPath, content);
  results.push({
    fromTool: 'cursor',
    fromPath: mcpPath,
    toPath: AB_MCP,
    feature: 'mcp',
  });
}
