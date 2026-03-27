/**
 * Gemini CLI target importer — GEMINI.md, .gemini/rules, .gemini/commands,
 * .gemini/settings.json → canonical .agentsmesh/.
 */

import { realpathSync } from 'node:fs';
import { join, basename, dirname, relative } from 'node:path';
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
import {
  parseProjectedAgentSkillFrontmatter,
  serializeImportedAgent,
} from '../projection/projected-agent-skill.js';
import { mapGeminiCommandFile, mapGeminiRuleFile } from './importer-mappers.js';
import {
  GEMINI_TARGET,
  GEMINI_ROOT,
  GEMINI_COMPAT_AGENTS,
  GEMINI_COMPAT_INNER_ROOT,
  GEMINI_RULES_DIR,
  GEMINI_COMMANDS_DIR,
  GEMINI_SKILLS_DIR,
  GEMINI_AGENTS_DIR,
  GEMINI_SYSTEM,
  GEMINI_CANONICAL_RULES_DIR,
  GEMINI_CANONICAL_COMMANDS_DIR,
  GEMINI_CANONICAL_AGENTS_DIR,
  GEMINI_CANONICAL_SKILLS_DIR,
} from './constants.js';
import { importGeminiSettings, importGeminiIgnore } from './format-helpers.js';
import { importGeminiPolicies } from './policies-importer.js';

/**
 * Import Gemini config into canonical .agentsmesh/.
 *
 * @param projectRoot - Project root directory
 * @returns Import results for each imported file
 */
export async function importFromGemini(projectRoot: string): Promise<ImportResult[]> {
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(GEMINI_TARGET, projectRoot);
  const normalizeCodex = await createImportReferenceNormalizer('codex-cli', projectRoot);
  const rulesDir = join(projectRoot, GEMINI_CANONICAL_RULES_DIR);
  const commandsDir = join(projectRoot, GEMINI_CANONICAL_COMMANDS_DIR);

  const geminiRootPath = join(projectRoot, GEMINI_ROOT);
  const compatAgentsRootPath = join(projectRoot, GEMINI_COMPAT_AGENTS);
  const compatInnerRootPath = join(projectRoot, GEMINI_COMPAT_INNER_ROOT);
  const systemPath = join(projectRoot, GEMINI_SYSTEM);

  const geminiRootContent = await readFileSafe(geminiRootPath);
  const compatAgentsRootContent = await readFileSafe(compatAgentsRootPath);
  const compatInnerRootContent = await readFileSafe(compatInnerRootPath);
  const systemContent = await readFileSafe(systemPath);

  const rootCandidate =
    [
      { path: compatAgentsRootPath, content: compatAgentsRootContent },
      { path: compatInnerRootPath, content: compatInnerRootContent },
      { path: geminiRootPath, content: geminiRootContent },
      { path: systemPath, content: systemContent },
    ].find((c) => c.content !== null) ?? null;

  const rootSourcePath = rootCandidate?.path ?? systemPath;
  const rootContent = rootCandidate?.content ?? null;
  if (rootContent !== null) {
    await mkdirp(rulesDir);
    const destPath = join(rulesDir, '_root.md');
    const compatNormalized =
      rootSourcePath === compatAgentsRootPath || rootSourcePath === compatInnerRootPath
        ? normalize(normalizeCodex(rootContent, rootSourcePath, destPath), rootSourcePath, destPath)
        : normalize(rootContent, rootSourcePath, destPath);
    const normalizedRoot = stripProjectRootCanonicalPrefix(
      compatNormalized
        .replace(/\.agents\/skills\//g, '.agentsmesh/skills/')
        .replace(/\.agents\\skills\\/g, '.agentsmesh/skills/'),
      projectRoot,
    );
    const { frontmatter, body } = parseFrontmatter(normalizedRoot);
    const hasRoot = frontmatter.root === true;
    const outFm = hasRoot ? frontmatter : { ...frontmatter, root: true };
    const outContent = stripProjectRootCanonicalPrefix(
      await serializeImportedRuleWithFallback(destPath, outFm, body),
      projectRoot,
    );
    await writeFileAtomic(destPath, outContent);
    results.push({
      fromTool: 'gemini-cli',
      fromPath: rootSourcePath,
      toPath: `${GEMINI_CANONICAL_RULES_DIR}/_root.md`,
      feature: 'rules',
    });
  }

  const geminiRulesPath = join(projectRoot, GEMINI_RULES_DIR);
  results.push(
    ...(await importFileDirectory({
      srcDir: geminiRulesPath,
      destDir: rulesDir,
      extensions: ['.md'],
      fromTool: 'gemini-cli',
      normalize,
      mapEntry: ({ srcPath, normalizeTo }) => mapGeminiRuleFile(srcPath, rulesDir, normalizeTo),
    })),
  );

  const geminiCommandsPath = join(projectRoot, GEMINI_COMMANDS_DIR);
  results.push(
    ...(await importFileDirectory({
      srcDir: geminiCommandsPath,
      destDir: commandsDir,
      extensions: ['.md', '.toml'],
      fromTool: 'gemini-cli',
      normalize,
      mapEntry: ({ srcPath, normalizeTo }) =>
        mapGeminiCommandFile(srcPath, commandsDir, normalizeTo, geminiCommandsPath),
    })),
  );

  const geminiSkillsPath = join(projectRoot, GEMINI_SKILLS_DIR);
  const skillDirs = await readDirRecursive(geminiSkillsPath);
  const skillMdFiles = skillDirs.filter((f) => basename(f) === 'SKILL.md');
  for (const srcPath of skillMdFiles) {
    const content = await readFileSafe(srcPath);
    if (!content) continue;
    const skillName = basename(srcPath.slice(0, -'/SKILL.md'.length));
    const rawParsed = parseFrontmatter(content);
    const projectedAgent = parseProjectedAgentSkillFrontmatter(rawParsed.frontmatter, skillName);
    if (projectedAgent) {
      const agentsDir = join(projectRoot, GEMINI_CANONICAL_AGENTS_DIR);
      await mkdirp(agentsDir);
      const agentPath = join(agentsDir, `${projectedAgent.name}.md`);
      await writeFileAtomic(
        agentPath,
        serializeImportedAgent(projectedAgent, normalize(rawParsed.body, srcPath, agentPath)),
      );
      results.push({
        fromTool: 'gemini-cli',
        fromPath: srcPath,
        toPath: `${GEMINI_CANONICAL_AGENTS_DIR}/${projectedAgent.name}.md`,
        feature: 'agents',
      });
      continue;
    }
    const destPath = join(projectRoot, GEMINI_CANONICAL_SKILLS_DIR, skillName, 'SKILL.md');
    const normalized = normalize(content, srcPath, destPath);
    const skillDir = join(projectRoot, GEMINI_CANONICAL_SKILLS_DIR, skillName);
    await mkdirp(skillDir);
    await writeFileAtomic(destPath, normalized);
    results.push({
      fromTool: 'gemini-cli',
      fromPath: srcPath,
      toPath: `${GEMINI_CANONICAL_SKILLS_DIR}/${skillName}/SKILL.md`,
      feature: 'skills',
    });
    const allSkillFiles = await readDirRecursive(dirname(srcPath));
    for (const absPath of allSkillFiles) {
      if (absPath === srcPath) continue;
      const supportContent = await readFileSafe(absPath);
      if (supportContent === null) continue;
      const relPath = relative(dirname(srcPath), absPath).replace(/\\/g, '/');
      const destSupportPath = join(skillDir, relPath);
      await mkdirp(dirname(destSupportPath));
      await writeFileAtomic(destSupportPath, normalize(supportContent, absPath, destSupportPath));
      results.push({
        fromTool: 'gemini-cli',
        fromPath: absPath,
        toPath: `${GEMINI_CANONICAL_SKILLS_DIR}/${skillName}/${relPath}`,
        feature: 'skills',
      });
    }
  }

  const geminiAgentsPath = join(projectRoot, GEMINI_AGENTS_DIR);
  try {
    const agentFiles = await readDirRecursive(geminiAgentsPath);
    const agentMdFiles = agentFiles.filter((f) => f.endsWith('.md'));
    const { serializeFrontmatter } = await import('../../utils/text/markdown.js');
    for (const srcPath of agentMdFiles) {
      const content = await readFileSafe(srcPath);
      if (!content) continue;
      const { frontmatter, body } = parseFrontmatter(content);
      const name =
        typeof frontmatter.name === 'string' ? frontmatter.name : basename(srcPath, '.md');
      const agentsDir = join(projectRoot, GEMINI_CANONICAL_AGENTS_DIR);
      await mkdirp(agentsDir);
      const destPath = join(agentsDir, `${name}.md`);
      const normalizedBody = normalize(body, srcPath, destPath);
      const outFm: Record<string, unknown> = { name };
      if (typeof frontmatter.description === 'string') outFm.description = frontmatter.description;
      if (Array.isArray(frontmatter.tools) && frontmatter.tools.length > 0)
        outFm.tools = frontmatter.tools;
      if (typeof frontmatter.model === 'string') outFm.model = frontmatter.model;
      const maxTurns = frontmatter.maxTurns ?? frontmatter['max-turns'] ?? frontmatter.max_turns;
      if (typeof maxTurns === 'number') outFm.maxTurns = maxTurns;
      const pm =
        frontmatter.permissionMode ?? frontmatter['permission-mode'] ?? frontmatter.permission_mode;
      if (typeof pm === 'string') outFm.permissionMode = pm;
      const dt =
        frontmatter.disallowedTools ??
        frontmatter['disallowed-tools'] ??
        frontmatter.disallowed_tools;
      if (Array.isArray(dt) && dt.length > 0) outFm.disallowedTools = dt;
      await writeFileAtomic(destPath, serializeFrontmatter(outFm, normalizedBody.trim() || ''));
      results.push({
        fromTool: 'gemini-cli',
        fromPath: srcPath,
        toPath: `${GEMINI_CANONICAL_AGENTS_DIR}/${name}.md`,
        feature: 'agents',
      });
    }
  } catch {
    /* GEMINI_AGENTS_DIR may not exist */
  }

  await importGeminiSettings(projectRoot, results);
  await importGeminiIgnore(projectRoot, results);
  results.push(...(await importGeminiPolicies(projectRoot)));

  return results;
}

function stripProjectRootCanonicalPrefix(content: string, projectRoot: string): string {
  const variants = new Set([
    projectRoot,
    projectRoot.replace(/\\/g, '/'),
    projectRoot.replace(/\//g, '\\'),
  ]);
  try {
    variants.add(realpathSync(projectRoot));
    variants.add(realpathSync.native(projectRoot));
  } catch {
    // Keep direct path variants when realpath lookup fails.
  }

  const stripped = Array.from(variants).reduce((next, variant) => {
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return next
      .replace(new RegExp(`${escaped}[/\\\\]\\.agentsmesh[/\\\\]`, 'g'), '.agentsmesh/')
      .replaceAll(`${variant}/.agentsmesh`, '.agentsmesh')
      .replaceAll(`${variant}\\.agentsmesh`, '.agentsmesh');
  }, content);

  return stripped.replace(/(?:[A-Za-z]:)?[^\s"'`()<>]+[/\\]\.agentsmesh[/\\]/g, '.agentsmesh/');
}
