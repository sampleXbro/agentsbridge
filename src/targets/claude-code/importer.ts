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
import { createImportReferenceNormalizer } from '../../core/import-reference-rewriter.js';
import { readFileSafe, readDirRecursive, writeFileAtomic, mkdirp } from '../../utils/fs.js';
import { parseFrontmatter } from '../../utils/markdown.js';
import { serializeImportedRuleWithFallback } from '../import-metadata.js';
import { importFileDirectory } from '../import-orchestrator.js';
import { mapClaudeMarkdownFile, mapClaudeRuleFile } from './importer-mappers.js';
import { importMcpJson, importSettings } from './settings-helpers.js';

const CLAUDE_MD = '.claude/CLAUDE.md';
const CLAUDE_MD_LEGACY = 'CLAUDE.md';
const CLAUDE_RULES_DIR = '.claude/rules';
const CLAUDE_COMMANDS_DIR = '.claude/commands';
const CLAUDE_AGENTS_DIR = '.claude/agents';
const CLAUDE_SKILLS_DIR = '.claude/skills';
const CLAUDEIGNORE = '.claudeignore';

const AB_RULES = '.agentsmesh/rules';
const AB_COMMANDS = '.agentsmesh/commands';
const AB_AGENTS = '.agentsmesh/agents';
const AB_SKILLS = '.agentsmesh/skills';
const AB_IGNORE = '.agentsmesh/ignore';

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
  const destDir = join(projectRoot, AB_RULES);

  // Try .claude/CLAUDE.md first (preferred per official docs), then fall back to CLAUDE.md (legacy)
  const primaryClaudePath = join(projectRoot, CLAUDE_MD);
  const primaryContent = await readFileSafe(primaryClaudePath);
  const legacyClaudePath = join(projectRoot, CLAUDE_MD_LEGACY);
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
      toPath: `${AB_RULES}/_root.md`,
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
  const destDir = join(projectRoot, AB_COMMANDS);
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
  const destDir = join(projectRoot, AB_AGENTS);
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
  const destBase = join(projectRoot, AB_SKILLS);

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
      const toPath = `${AB_SKILLS}/${skillName}/${relPath}`;
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
  const ignorePath = join(projectRoot, CLAUDEIGNORE);
  const content = await readFileSafe(ignorePath);
  if (content === null) return;
  const destPath = join(projectRoot, AB_IGNORE);
  await mkdirp(dirname(destPath));
  await writeFileAtomic(destPath, content);
  results.push({
    fromTool: 'claude-code',
    fromPath: ignorePath,
    toPath: AB_IGNORE,
    feature: 'ignore',
  });
}
