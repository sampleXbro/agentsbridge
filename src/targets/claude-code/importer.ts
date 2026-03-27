/**
 * Claude Code target importer — full fidelity import into canonical .agentsmesh/.
 *
 * Sources imported:
 *   .claude/CLAUDE.md            → .agentsmesh/rules/_root.md
 *   CLAUDE.md (legacy fallback)  → .agentsmesh/rules/_root.md
 *   .claude/rules/*.md           → .agentsmesh/rules/*.md
 *   .claude/commands/*.md        → .agentsmesh/commands/*.md
 *   .claude/agents/*.md          → .agentsmesh/agents/*.md
 *   .claude/skills/{name}/SKILL.md + supporting files → .agentsmesh/skills/{name}/
 *   .claude/settings.json        → .agentsmesh/mcp.json (mcpServers)
 *                                  .agentsmesh/permissions.yaml (permissions)
 *                                  .agentsmesh/hooks.yaml (hooks)
 *   .claudeignore                → .agentsmesh/ignore
 */

import { join, basename, relative, dirname } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import {
  readFileSafe,
  readDirRecursive,
  writeFileAtomic,
  mkdirp,
} from '../../utils/filesystem/fs.js';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import { serializeImportedRuleWithFallback } from '../import/import-metadata.js';
import { importFileDirectory } from '../import/import-orchestrator.js';
import { mapClaudeMarkdownFile, mapClaudeRuleFile } from './importer-mappers.js';
import { importMcpJson, importSettings } from './settings-helpers.js';
import {
  CLAUDE_ROOT,
  CLAUDE_LEGACY_ROOT,
  CLAUDE_RULES_DIR,
  CLAUDE_COMMANDS_DIR,
  CLAUDE_AGENTS_DIR,
  CLAUDE_SKILLS_DIR,
  CLAUDE_IGNORE,
  CLAUDE_CANONICAL_RULES_DIR,
  CLAUDE_CANONICAL_COMMANDS_DIR,
  CLAUDE_CANONICAL_AGENTS_DIR,
  CLAUDE_CANONICAL_SKILLS_DIR,
  CLAUDE_CANONICAL_IGNORE,
} from './constants.js';

/**
 * Import Claude Code config into canonical .agentsmesh/.
 * @param projectRoot - Project root directory
 * @returns Import results for each imported file
 */
export async function importFromClaudeCode(projectRoot: string): Promise<ImportResult[]> {
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer('claude-code', projectRoot);

  await importRules(projectRoot, results, normalize);
  await importCommands(projectRoot, results, normalize);
  await importAgents(projectRoot, results, normalize);
  await importSkills(projectRoot, results, normalize);
  await importMcpJson(projectRoot, results);
  await importSettings(projectRoot, results);
  await importIgnore(projectRoot, results);

  return results;
}

async function importRules(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const destDir = join(projectRoot, CLAUDE_CANONICAL_RULES_DIR);

  // Try .claude/CLAUDE.md first (preferred per official docs), then fall back to CLAUDE.md (legacy)
  const primaryClaudePath = join(projectRoot, CLAUDE_ROOT);
  const primaryContent = await readFileSafe(primaryClaudePath);
  const legacyClaudePath = join(projectRoot, CLAUDE_LEGACY_ROOT);
  const legacyContent = primaryContent === null ? await readFileSafe(legacyClaudePath) : null;
  const claudeContent = primaryContent ?? legacyContent;
  const claudePath = primaryContent !== null ? primaryClaudePath : legacyClaudePath;

  if (claudeContent !== null) {
    await mkdirp(destDir);
    const destPath = join(destDir, '_root.md');
    const { frontmatter, body } = parseFrontmatter(normalize(claudeContent, claudePath, destPath));
    const hasRoot = frontmatter.root === true;
    const outFm = hasRoot ? frontmatter : { ...frontmatter, root: true };
    const outContent = await serializeImportedRuleWithFallback(destPath, outFm, body);
    await writeFileAtomic(destPath, outContent);
    results.push({
      fromTool: 'claude-code',
      fromPath: claudePath,
      toPath: `${CLAUDE_CANONICAL_RULES_DIR}/_root.md`,
      feature: 'rules',
    });
  }

  const rulesDir = join(projectRoot, CLAUDE_RULES_DIR);
  results.push(
    ...(await importFileDirectory({
      srcDir: rulesDir,
      destDir,
      extensions: ['.md'],
      fromTool: 'claude-code',
      normalize,
      mapEntry: ({ srcPath, normalizeTo }) => mapClaudeRuleFile(srcPath, destDir, normalizeTo),
    })),
  );
}

async function importCommands(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const destDir = join(projectRoot, CLAUDE_CANONICAL_COMMANDS_DIR);
  const commandsDir = join(projectRoot, CLAUDE_COMMANDS_DIR);
  results.push(
    ...(await importFileDirectory({
      srcDir: commandsDir,
      destDir,
      extensions: ['.md'],
      fromTool: 'claude-code',
      normalize,
      mapEntry: ({ srcPath, normalizeTo }) =>
        mapClaudeMarkdownFile(srcPath, destDir, 'commands', normalizeTo),
    })),
  );
}

async function importAgents(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const destDir = join(projectRoot, CLAUDE_CANONICAL_AGENTS_DIR);
  const agentsDir = join(projectRoot, CLAUDE_AGENTS_DIR);
  results.push(
    ...(await importFileDirectory({
      srcDir: agentsDir,
      destDir,
      extensions: ['.md'],
      fromTool: 'claude-code',
      normalize,
      mapEntry: ({ srcPath, normalizeTo }) =>
        mapClaudeMarkdownFile(srcPath, destDir, 'agents', normalizeTo),
    })),
  );
}

async function importSkills(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const skillsBaseDir = join(projectRoot, CLAUDE_SKILLS_DIR);
  const destBase = join(projectRoot, CLAUDE_CANONICAL_SKILLS_DIR);

  const allFiles = await readDirRecursive(skillsBaseDir);
  const skillMdFiles = allFiles.filter((f) => f.endsWith('SKILL.md'));

  for (const skillMdPath of skillMdFiles) {
    const skillDir = dirname(skillMdPath);
    const skillName = basename(skillDir);
    const destSkillDir = join(destBase, skillName);

    const skillFiles = await readDirRecursive(skillDir);
    for (const filePath of skillFiles) {
      const fileContent = await readFileSafe(filePath);
      if (fileContent === null) continue;
      const relPath = relative(skillDir, filePath);
      const destPath = join(destSkillDir, relPath);
      await mkdirp(dirname(destPath));
      await writeFileAtomic(destPath, normalize(fileContent, filePath, destPath));
      const toPath = `${CLAUDE_CANONICAL_SKILLS_DIR}/${skillName}/${relPath}`;
      results.push({
        fromTool: 'claude-code',
        fromPath: filePath,
        toPath,
        feature: 'skills',
      });
    }
  }
}

async function importIgnore(projectRoot: string, results: ImportResult[]): Promise<void> {
  const ignorePath = join(projectRoot, CLAUDE_IGNORE);
  const content = await readFileSafe(ignorePath);
  if (content === null) return;
  const destPath = join(projectRoot, CLAUDE_CANONICAL_IGNORE);
  await mkdirp(dirname(destPath));
  await writeFileAtomic(destPath, content);
  results.push({
    fromTool: 'claude-code',
    fromPath: ignorePath,
    toPath: CLAUDE_CANONICAL_IGNORE,
    feature: 'ignore',
  });
}
