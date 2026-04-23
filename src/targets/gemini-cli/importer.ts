/**
 * Gemini CLI target importer — GEMINI.md, .gemini/rules, .gemini/commands,
 * .gemini/settings.json → canonical .agentsmesh/.
 */

import { join } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { readFileSafe, writeFileAtomic, mkdirp } from '../../utils/filesystem/fs.js';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import { serializeImportedRuleWithFallback } from '../import/import-metadata.js';
import { splitEmbeddedRulesToCanonical } from '../import/embedded-rules.js';
import { importFileDirectory } from '../import/import-orchestrator.js';
import { mapGeminiCommandFile, mapGeminiRuleFile } from './importer-mappers.js';
import {
  GEMINI_TARGET,
  GEMINI_ROOT,
  GEMINI_COMPAT_AGENTS,
  GEMINI_COMPAT_INNER_ROOT,
  GEMINI_RULES_DIR,
  GEMINI_COMMANDS_DIR,
  GEMINI_SYSTEM,
  GEMINI_CANONICAL_RULES_DIR,
  GEMINI_CANONICAL_COMMANDS_DIR,
} from './constants.js';
import { importGeminiSettings, importGeminiIgnore } from './format-helpers.js';
import { importGeminiPolicies } from './policies-importer.js';
import { stripProjectRootCanonicalPrefix } from './importer-strip.js';
import { importGeminiSkillsAndAgents } from './importer-skills-agents.js';

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
    const compatContent =
      rootSourcePath === compatAgentsRootPath || rootSourcePath === compatInnerRootPath
        ? normalizeCodex(rootContent, rootSourcePath, destPath)
        : rootContent;
    const split = await splitEmbeddedRulesToCanonical({
      content: compatContent,
      projectRoot,
      rulesDir: GEMINI_CANONICAL_RULES_DIR,
      sourcePath: rootSourcePath,
      fromTool: 'gemini-cli',
      normalize,
    });
    results.push(...split.results);
    const compatNormalized = normalize(split.rootContent, rootSourcePath, destPath);
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
      mapEntry: ({ relativePath, normalizeTo }) =>
        mapGeminiRuleFile(relativePath, rulesDir, normalizeTo),
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
      mapEntry: ({ relativePath, normalizeTo }) =>
        mapGeminiCommandFile(relativePath, commandsDir, normalizeTo),
    })),
  );

  await importGeminiSkillsAndAgents(projectRoot, results, normalize);

  await importGeminiSettings(projectRoot, results);
  await importGeminiIgnore(projectRoot, results);
  results.push(...(await importGeminiPolicies(projectRoot)));

  return results;
}
