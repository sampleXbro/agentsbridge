import { basename, extname, join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { ImportResult, McpServer } from '../../core/types.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { readDirRecursive, readFileSafe, writeFileAtomic } from '../../utils/filesystem/fs.js';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import { importEmbeddedSkills } from '../import/embedded-skill.js';
import {
  serializeImportedCommandWithFallback,
  serializeImportedRuleWithFallback,
} from '../import/import-metadata.js';
import { toStringArray, toStringRecord } from '../import/shared-import-helpers.js';
import { parseCommandRuleFrontmatter, serializeImportedCommand } from './command-rule.js';
import {
  CONTINUE_TARGET,
  CONTINUE_MCP_DIR,
  CONTINUE_PROMPTS_DIR,
  CONTINUE_RULES_DIR,
  CONTINUE_SKILLS_DIR,
  CONTINUE_CANONICAL_RULES_DIR,
  CONTINUE_CANONICAL_COMMANDS_DIR,
  CONTINUE_CANONICAL_MCP,
} from './constants.js';

function isContinueRootRuleRelativePath(relativePath: string): boolean {
  return relativePath === 'general.md' || relativePath === '_root.md';
}

function readMcpServers(content: string, extension: string): Record<string, McpServer> {
  const parsed =
    extension === '.json'
      ? (JSON.parse(content) as Record<string, unknown>)
      : ((parseYaml(content) as Record<string, unknown>) ?? {});
  const rawServers = parsed.mcpServers;

  if (rawServers && typeof rawServers === 'object' && !Array.isArray(rawServers)) {
    const servers: Record<string, McpServer> = {};
    for (const [name, value] of Object.entries(rawServers)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      const server = value as Record<string, unknown>;
      if (typeof server.command === 'string') {
        servers[name] = {
          type: typeof server.type === 'string' ? server.type : 'stdio',
          command: server.command,
          args: toStringArray(server.args),
          env: toStringRecord(server.env),
          description: typeof server.description === 'string' ? server.description : undefined,
        };
      }
    }
    return servers;
  }

  return {};
}

export async function importFromContinue(projectRoot: string): Promise<ImportResult[]> {
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(CONTINUE_TARGET, projectRoot);
  await importRules(projectRoot, results, normalize);
  await importCommands(projectRoot, results, normalize);
  await importEmbeddedSkills(projectRoot, CONTINUE_SKILLS_DIR, 'continue', results, normalize);
  await importMcp(projectRoot, results);
  return results;
}

async function importRules(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const files = (await readDirRecursive(join(projectRoot, CONTINUE_RULES_DIR))).filter((file) =>
    file.endsWith('.md'),
  );
  const rulesRoot = join(projectRoot, CONTINUE_RULES_DIR);
  for (const srcPath of files) {
    const source = await readFileSafe(srcPath);
    if (!source) continue;
    const relativePath = relative(rulesRoot, srcPath).replace(/\\/g, '/');
    const canonicalRelative = isContinueRootRuleRelativePath(relativePath)
      ? '_root.md'
      : relativePath;
    const destPath = join(projectRoot, CONTINUE_CANONICAL_RULES_DIR, canonicalRelative);
    const { frontmatter, body } = parseFrontmatter(normalize(source, srcPath, destPath));
    const canonicalFrontmatter: Record<string, unknown> = {
      description:
        typeof frontmatter.description === 'string' ? frontmatter.description : undefined,
      globs: Array.isArray(frontmatter.globs) ? frontmatter.globs : undefined,
      root: isContinueRootRuleRelativePath(relativePath),
    };
    if (canonicalFrontmatter.description === undefined) delete canonicalFrontmatter.description;
    if (canonicalFrontmatter.globs === undefined) delete canonicalFrontmatter.globs;
    const content = await serializeImportedRuleWithFallback(destPath, canonicalFrontmatter, body);
    await writeFileAtomic(destPath, content);
    results.push({
      fromTool: 'continue',
      fromPath: srcPath,
      toPath: `${CONTINUE_CANONICAL_RULES_DIR}/${canonicalRelative}`,
      feature: 'rules',
    });
  }
}

async function importCommands(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const files = (await readDirRecursive(join(projectRoot, CONTINUE_PROMPTS_DIR))).filter((file) =>
    file.endsWith('.md'),
  );
  const promptsRoot = join(projectRoot, CONTINUE_PROMPTS_DIR);
  for (const srcPath of files) {
    const source = await readFileSafe(srcPath);
    if (!source) continue;
    const relativePath = relative(promptsRoot, srcPath).replace(/\\/g, '/');
    const destPath = join(projectRoot, CONTINUE_CANONICAL_COMMANDS_DIR, relativePath);
    const { frontmatter, body } = parseFrontmatter(normalize(source, srcPath, destPath));
    const command = parseCommandRuleFrontmatter(frontmatter, srcPath);
    const commandName = command.name || basename(relativePath, '.md');
    const relativeDir = relativePath.includes('/')
      ? relativePath.slice(0, relativePath.lastIndexOf('/'))
      : '';
    const relativeCommandPath = relativeDir
      ? `${relativeDir}/${commandName}.md`
      : `${commandName}.md`;
    const commandPath = join(projectRoot, CONTINUE_CANONICAL_COMMANDS_DIR, relativeCommandPath);
    const content = await serializeImportedCommandWithFallback(
      commandPath,
      {
        description: command.description,
        hasDescription: Boolean(command.description),
        allowedTools: command.allowedTools,
        hasAllowedTools: command.allowedTools.length > 0,
      },
      parseFrontmatter(serializeImportedCommand(command, body)).body,
    );
    await writeFileAtomic(commandPath, content);
    results.push({
      fromTool: 'continue',
      fromPath: srcPath,
      toPath: `${CONTINUE_CANONICAL_COMMANDS_DIR}/${relativeCommandPath}`,
      feature: 'commands',
    });
  }
}

async function importMcp(projectRoot: string, results: ImportResult[]): Promise<void> {
  const files = (await readDirRecursive(join(projectRoot, CONTINUE_MCP_DIR))).filter((file) =>
    ['.json', '.yaml', '.yml'].includes(extname(file)),
  );
  const mergedServers: Record<string, McpServer> = {};
  const importedFrom: string[] = [];

  for (const srcPath of files) {
    const content = await readFileSafe(srcPath);
    if (!content) continue;
    Object.assign(mergedServers, readMcpServers(content, extname(srcPath)));
    importedFrom.push(srcPath);
  }

  if (Object.keys(mergedServers).length === 0) return;
  const destPath = join(projectRoot, CONTINUE_CANONICAL_MCP);
  await writeFileAtomic(destPath, JSON.stringify({ mcpServers: mergedServers }, null, 2));
  for (const fromPath of importedFrom) {
    results.push({
      fromTool: CONTINUE_TARGET,
      fromPath,
      toPath: CONTINUE_CANONICAL_MCP,
      feature: 'mcp',
    });
  }
}
