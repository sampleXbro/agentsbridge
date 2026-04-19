/**
 * Import Cursor global artifacts under `$HOME`:
 * - `~/.cursor/rules/*.mdc` (same semantics as project import)
 * - legacy `~/.agentsmesh-exports/cursor/user-rules.md`
 * - `~/.cursor/AGENTS.md` aggregate fallback when no structured root exists
 * - `~/.cursor/mcp.json`, skills, agents, commands, hooks.json, cursorignore
 */

import { join, dirname } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import {
  readFileSafe,
  readDirRecursive,
  writeFileAtomic,
  mkdirp,
  exists,
} from '../../utils/filesystem/fs.js';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import { serializeImportedRuleWithFallback } from '../import/import-metadata.js';
import { importFileDirectory } from '../import/import-orchestrator.js';
import {
  CURSOR_GLOBAL_USER_RULES,
  CURSOR_GLOBAL_MCP_EXPORT,
  CURSOR_GLOBAL_SKILLS_DIR,
  CURSOR_GLOBAL_AGENTS_DIR,
  CURSOR_COMMANDS_DIR,
  CURSOR_CANONICAL_RULES_DIR,
  CURSOR_CANONICAL_MCP,
  CURSOR_CANONICAL_AGENTS_DIR,
  CURSOR_CANONICAL_COMMANDS_DIR,
  CURSOR_RULES_DIR,
  CURSOR_DOT_CURSOR_AGENTS,
  CURSOR_HOOKS,
  CURSOR_IGNORE,
} from './constants.js';
import { importSkills } from './skills-adapter.js';
import { mapCursorAgentFile, mapCursorCommandFile, mapCursorRuleFile } from './importer-mappers.js';
import { importSettings, importIgnore } from './settings-helpers.js';

const CURSOR_TARGET = 'cursor';

async function hasGlobalCursorArtifacts(projectRoot: string): Promise<boolean> {
  if (await exists(join(projectRoot, CURSOR_RULES_DIR))) return true;
  const candidates = [
    join(projectRoot, CURSOR_DOT_CURSOR_AGENTS),
    join(projectRoot, CURSOR_GLOBAL_USER_RULES),
    join(projectRoot, CURSOR_GLOBAL_MCP_EXPORT),
    join(projectRoot, CURSOR_HOOKS),
    join(projectRoot, CURSOR_IGNORE),
    join(projectRoot, CURSOR_GLOBAL_SKILLS_DIR),
    join(projectRoot, CURSOR_GLOBAL_AGENTS_DIR),
    join(projectRoot, CURSOR_COMMANDS_DIR),
  ];
  for (const p of candidates) {
    const stat = await readFileSafe(p);
    if (stat !== null && stat.trim() !== '') return true;
  }
  const skillFiles = await readDirRecursive(join(projectRoot, CURSOR_GLOBAL_SKILLS_DIR));
  if (skillFiles.some((f) => f.endsWith('.md'))) return true;
  const agentFiles = await readDirRecursive(join(projectRoot, CURSOR_GLOBAL_AGENTS_DIR));
  if (agentFiles.some((f) => f.endsWith('.md'))) return true;
  const commandFiles = await readDirRecursive(join(projectRoot, CURSOR_COMMANDS_DIR));
  if (commandFiles.some((f) => f.endsWith('.md'))) return true;
  return false;
}

async function importGlobalCursorRulesFromDir(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<boolean> {
  const destDir = join(projectRoot, CURSOR_CANONICAL_RULES_DIR);
  let rootWritten = false;
  const rulesDir = join(projectRoot, CURSOR_RULES_DIR);
  const batch = await importFileDirectory({
    srcDir: rulesDir,
    destDir,
    extensions: ['.mdc'],
    fromTool: CURSOR_TARGET,
    normalize,
    mapEntry: async ({ srcPath, relativePath, normalizeTo }) => {
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
  });
  results.push(...batch);
  return rootWritten;
}

async function importGlobalUserRules(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<boolean> {
  const srcPath = join(projectRoot, CURSOR_GLOBAL_USER_RULES);
  const raw = await readFileSafe(srcPath);
  if (raw === null || raw.trim() === '') return false;
  const destDir = join(projectRoot, CURSOR_CANONICAL_RULES_DIR);
  await mkdirp(destDir);
  const destPath = join(destDir, '_root.md');
  const normalized = normalize(raw.trim(), srcPath, destPath);
  const { frontmatter, body } = parseFrontmatter(normalized);
  const outFm = frontmatter.root === true ? frontmatter : { ...frontmatter, root: true };
  const outContent = await serializeImportedRuleWithFallback(destPath, outFm, body);
  await writeFileAtomic(destPath, outContent);
  results.push({
    fromTool: CURSOR_TARGET,
    fromPath: srcPath,
    toPath: `${CURSOR_CANONICAL_RULES_DIR}/_root.md`,
    feature: 'rules',
  });
  return true;
}

async function importGlobalDotCursorAgents(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<boolean> {
  const srcPath = join(projectRoot, CURSOR_DOT_CURSOR_AGENTS);
  const raw = await readFileSafe(srcPath);
  if (raw === null || raw.trim() === '') return false;
  const destDir = join(projectRoot, CURSOR_CANONICAL_RULES_DIR);
  await mkdirp(destDir);
  const destPath = join(destDir, '_root.md');
  const normalized = normalize(raw.trim(), srcPath, destPath);
  const { frontmatter, body } = parseFrontmatter(normalized);
  const outFm = frontmatter.root === true ? frontmatter : { ...frontmatter, root: true };
  const outContent = await serializeImportedRuleWithFallback(destPath, outFm, body);
  await writeFileAtomic(destPath, outContent);
  results.push({
    fromTool: CURSOR_TARGET,
    fromPath: srcPath,
    toPath: `${CURSOR_CANONICAL_RULES_DIR}/_root.md`,
    feature: 'rules',
  });
  return true;
}

async function importGlobalMcp(projectRoot: string, results: ImportResult[]): Promise<void> {
  const mcpPath = join(projectRoot, CURSOR_GLOBAL_MCP_EXPORT);
  const content = await readFileSafe(mcpPath);
  if (content === null || content.trim() === '') return;
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
    fromTool: CURSOR_TARGET,
    fromPath: mcpPath,
    toPath: CURSOR_CANONICAL_MCP,
    feature: 'mcp',
  });
}

async function importGlobalAgents(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const agentsDir = join(projectRoot, CURSOR_GLOBAL_AGENTS_DIR);
  const destDir = join(projectRoot, CURSOR_CANONICAL_AGENTS_DIR);
  results.push(
    ...(await importFileDirectory({
      srcDir: agentsDir,
      destDir,
      extensions: ['.md'],
      fromTool: CURSOR_TARGET,
      normalize,
      mapEntry: ({ relativePath, normalizeTo }) =>
        mapCursorAgentFile(relativePath, destDir, normalizeTo),
    })),
  );
}

async function importGlobalCommands(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const commandsDir = join(projectRoot, CURSOR_COMMANDS_DIR);
  const destDir = join(projectRoot, CURSOR_CANONICAL_COMMANDS_DIR);
  results.push(
    ...(await importFileDirectory({
      srcDir: commandsDir,
      destDir,
      extensions: ['.md'],
      fromTool: CURSOR_TARGET,
      normalize,
      mapEntry: ({ relativePath, normalizeTo }) =>
        mapCursorCommandFile(relativePath, destDir, normalizeTo),
    })),
  );
}

export async function importFromCursorGlobalExports(projectRoot: string): Promise<ImportResult[]> {
  if (!(await hasGlobalCursorArtifacts(projectRoot))) return [];
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(CURSOR_TARGET, projectRoot, 'global');
  let rootWritten = await importGlobalCursorRulesFromDir(projectRoot, results, normalize);
  if (!rootWritten) rootWritten = await importGlobalUserRules(projectRoot, results, normalize);
  if (!rootWritten) await importGlobalDotCursorAgents(projectRoot, results, normalize);
  await importGlobalMcp(projectRoot, results);
  await importSkills(projectRoot, results, normalize, CURSOR_GLOBAL_SKILLS_DIR);
  await importGlobalAgents(projectRoot, results, normalize);
  await importGlobalCommands(projectRoot, results, normalize);
  await importSettings(projectRoot, results);
  await importIgnore(projectRoot, results);
  return results;
}
