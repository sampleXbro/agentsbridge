/**
 * Codex CLI importer — imports canonical config from Codex project files.
 *
 * Sources imported:
 *   AGENTS.md (preferred) / codex.md (fallback) → .agentsmesh/rules/_root.md
 *   .agents/skills/am-command-{name}/SKILL.md   → .agentsmesh/commands/{name}.md
 *   .agents/skills/{name}/SKILL.md → .agentsmesh/skills/{name}/SKILL.md
 *   .codex/config.toml            → .agentsmesh/mcp.json (mcp_servers section)
 *   .codex/rules/*.rules (embed)  → .agentsmesh/rules/*.md (agentsmesh block)
 *   .codex/rules/*.md (legacy)    → .agentsmesh/rules/*.md
 *   nested AGENTS.md               → .agentsmesh/rules (scoped)
 */

import { join, relative, dirname, basename } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import { createImportReferenceNormalizer } from '../../core/import-reference-rewriter.js';
import { readFileSafe, readDirRecursive, writeFileAtomic, mkdirp } from '../../utils/fs.js';
import { parseFrontmatter } from '../../utils/markdown.js';
import { serializeImportedRuleWithFallback } from '../import-metadata.js';
import { importFileDirectory } from '../import-orchestrator.js';
import { serializeImportedAgent } from '../projected-agent-skill.js';
import { CODEX_MD, AGENTS_MD, CODEX_AGENTS_DIR } from './constants.js';
import { importCodexNonRootRuleFiles } from './import-codex-non-root-rules.js';
import { importMcp } from './mcp-helpers.js';
import { importSkills } from './skills-helpers.js';
import { shouldImportScopedAgentsRule, removePathIfExists } from '../scoped-agents-import.js';
import { parse as parseToml } from 'smol-toml';

const AB_RULES = '.agentsmesh/rules';

/**
 * Import Codex config into canonical .agentsmesh/.
 *
 * @param projectRoot - Project root directory
 * @returns Import results for each imported file
 */
export async function importFromCodex(projectRoot: string): Promise<ImportResult[]> {
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer('codex-cli', projectRoot);
  const normalizeWindsurf = await createImportReferenceNormalizer('windsurf', projectRoot);

  await importRules(projectRoot, results, normalize, normalizeWindsurf);
  await importSkills(projectRoot, results, normalize);
  await importAgents(projectRoot, results, normalize);
  await importMcp(projectRoot, results);

  return results;
}

async function importAgents(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const agentsPath = join(projectRoot, CODEX_AGENTS_DIR);
  const agentsDestDir = join(projectRoot, '.agentsmesh/agents');
  try {
    const agentFiles = await readDirRecursive(agentsPath);
    const tomlFiles = agentFiles.filter((f) => f.endsWith('.toml'));
    for (const srcPath of tomlFiles) {
      const content = await readFileSafe(srcPath);
      if (!content) continue;
      const parsed = parseToml(content) as Record<string, unknown> | null;
      if (!parsed || typeof parsed !== 'object') continue;
      const name = typeof parsed.name === 'string' ? parsed.name : basename(srcPath, '.toml');
      const description = typeof parsed.description === 'string' ? parsed.description : '';
      const body =
        typeof parsed.developer_instructions === 'string'
          ? parsed.developer_instructions.trim()
          : '';
      const model = typeof parsed.model === 'string' ? parsed.model : '';
      const sandbox = typeof parsed.sandbox_mode === 'string' ? parsed.sandbox_mode : '';
      const permissionMode =
        sandbox === 'read-only' ? 'read-only' : sandbox === 'workspace-write' ? 'allow' : '';
      const mcpServers: string[] = Array.isArray(parsed.mcp_servers)
        ? parsed.mcp_servers.filter((s): s is string => typeof s === 'string')
        : [];
      await mkdirp(agentsDestDir);
      const destPath = join(agentsDestDir, `${name}.md`);
      const normalizedBody = normalize(body, srcPath, destPath);
      const agent = {
        name,
        description,
        tools: [],
        disallowedTools: [],
        model,
        permissionMode,
        maxTurns: 0,
        mcpServers,
        hooks: {},
        skills: [],
        memory: '',
      };
      const outContent = serializeImportedAgent(agent, normalizedBody);
      await writeFileAtomic(destPath, outContent);
      results.push({
        fromTool: 'codex-cli',
        fromPath: srcPath,
        toPath: `.agentsmesh/agents/${name}.md`,
        feature: 'agents',
      });
    }
  } catch {
    /* CODEX_AGENTS_DIR may not exist */
  }
}

async function importRules(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
  normalizeWindsurf: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const codexPath = join(projectRoot, CODEX_MD);
  const agentsPath = join(projectRoot, AGENTS_MD);
  const agentsContent = await readFileSafe(agentsPath);
  const codexContent = await readFileSafe(codexPath);

  // Prefer AGENTS.md (official Codex path) over codex.md (legacy/fallback)
  const sourcePath = agentsContent !== null ? agentsPath : codexPath;
  const destDir = join(projectRoot, AB_RULES);
  const content = agentsContent ?? codexContent;
  if (content !== null) {
    await mkdirp(destDir);
    const destPath = join(destDir, '_root.md');
    const normalizedContent =
      sourcePath === agentsPath
        ? normalize(normalizeWindsurf(content, sourcePath, destPath), sourcePath, destPath)
        : normalize(content, sourcePath, destPath);
    const { frontmatter, body } = parseFrontmatter(normalizedContent);
    const outFm = frontmatter.root === true ? frontmatter : { ...frontmatter, root: true };
    const outContent = await serializeImportedRuleWithFallback(destPath, outFm, body);
    await writeFileAtomic(destPath, outContent);

    results.push({
      fromTool: 'codex-cli',
      fromPath: sourcePath,
      toPath: `${AB_RULES}/_root.md`,
      feature: 'rules',
    });
  }

  results.push(...(await importCodexNonRootRuleFiles(projectRoot, destDir, normalize)));

  results.push(
    ...(await importFileDirectory({
      srcDir: projectRoot,
      destDir,
      extensions: ['AGENTS.md', 'AGENTS.override.md'],
      fromTool: 'codex-cli',
      normalize,
      mapEntry: async ({ srcPath, normalizeTo }) => {
        const relDir = relative(projectRoot, dirname(srcPath)).replace(/\\/g, '/');
        const isOverride = srcPath.endsWith('/AGENTS.override.md');
        if (!relDir || relDir === '.') return null;
        if (!isOverride && !srcPath.endsWith('/AGENTS.md')) return null;
        const ruleName = relDir.replace(/\//g, '-');
        if (!shouldImportScopedAgentsRule(relDir)) {
          await removePathIfExists(join(destDir, `${ruleName}.md`));
          return null;
        }
        const destPath = join(destDir, `${ruleName}.md`);
        const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
        return {
          destPath,
          toPath: `${AB_RULES}/${ruleName}.md`,
          feature: 'rules',
          content: await serializeImportedRuleWithFallback(
            destPath,
            {
              ...frontmatter,
              root: false,
              globs: [`${relDir}/**`],
              ...(isOverride ? { codex_instruction: 'override' } : {}),
            },
            body,
          ),
        };
      },
    })),
  );
}
