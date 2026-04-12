import { join } from 'node:path';
import type { ImportResult, Hooks, McpServer } from '../../core/types.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { importEmbeddedSkills } from '../import/embedded-skill.js';
import { importFileDirectory } from '../import/import-orchestrator.js';
import { serializeImportedRuleWithFallback } from '../import/import-metadata.js';
import { toGlobsArray, toStringArray, toStringRecord } from '../import/shared-import-helpers.js';
import { readDirRecursive, readFileSafe, writeFileAtomic } from '../../utils/filesystem/fs.js';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import { parseKiroHookFile, serializeCanonicalHooks } from './hook-format.js';
import {
  KIRO_TARGET,
  KIRO_AGENTS_MD,
  KIRO_STEERING_DIR,
  KIRO_SKILLS_DIR,
  KIRO_HOOKS_DIR,
  KIRO_MCP_FILE,
  KIRO_IGNORE,
  KIRO_CANONICAL_ROOT_RULE,
  KIRO_CANONICAL_RULES_DIR,
  KIRO_CANONICAL_MCP,
  KIRO_CANONICAL_HOOKS,
  KIRO_CANONICAL_IGNORE,
} from './constants.js';

function readMcpServers(content: string): Record<string, McpServer> {
  const parsed = JSON.parse(content) as Record<string, unknown>;
  const rawServers = parsed.mcpServers;
  if (!rawServers || typeof rawServers !== 'object' || Array.isArray(rawServers)) return {};
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
      };
      continue;
    }
    if (typeof server.url === 'string') {
      servers[name] = {
        type: typeof server.type === 'string' ? server.type : 'http',
        url: server.url,
        headers: toStringRecord(server.headers),
        env: toStringRecord(server.env),
      };
    }
  }
  return servers;
}

function canonicalRuleMeta(frontmatter: Record<string, unknown>): Record<string, unknown> {
  const inclusion = typeof frontmatter.inclusion === 'string' ? frontmatter.inclusion : '';
  const meta: Record<string, unknown> = {
    root: false,
    description: typeof frontmatter.description === 'string' ? frontmatter.description : undefined,
    globs: toGlobsArray(frontmatter.fileMatchPattern),
  };
  if (inclusion === 'manual') meta.trigger = 'manual';
  if (inclusion === 'auto') meta.trigger = 'model_decision';
  if (inclusion === 'fileMatch') meta.trigger = 'glob';
  return meta;
}

async function importRoot(
  projectRoot: string,
  results: ImportResult[],
  normalize: ReturnType<typeof createImportReferenceNormalizer> extends Promise<infer T>
    ? T
    : never,
): Promise<void> {
  const srcPath = join(projectRoot, KIRO_AGENTS_MD);
  const content = await readFileSafe(srcPath);
  if (content === null) return;
  const destPath = join(projectRoot, KIRO_CANONICAL_ROOT_RULE);
  const { frontmatter, body } = parseFrontmatter(normalize(content, srcPath, destPath));
  await writeFileAtomic(
    destPath,
    await serializeImportedRuleWithFallback(destPath, { ...frontmatter, root: true }, body),
  );
  results.push({
    fromTool: KIRO_TARGET,
    fromPath: srcPath,
    toPath: KIRO_CANONICAL_ROOT_RULE,
    feature: 'rules',
  });
}

async function importRules(
  projectRoot: string,
  results: ImportResult[],
  normalize: ReturnType<typeof createImportReferenceNormalizer> extends Promise<infer T>
    ? T
    : never,
): Promise<void> {
  results.push(
    ...(await importFileDirectory({
      srcDir: join(projectRoot, KIRO_STEERING_DIR),
      destDir: join(projectRoot, KIRO_CANONICAL_RULES_DIR),
      extensions: ['.md'],
      fromTool: KIRO_TARGET,
      normalize,
      mapEntry: async ({ relativePath, normalizeTo }) => {
        const destPath = join(projectRoot, KIRO_CANONICAL_RULES_DIR, relativePath);
        const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
        return {
          destPath,
          toPath: `${KIRO_CANONICAL_RULES_DIR}/${relativePath}`,
          feature: 'rules',
          content: await serializeImportedRuleWithFallback(
            destPath,
            canonicalRuleMeta(frontmatter),
            body,
          ),
        };
      },
    })),
  );
}

async function importMcp(projectRoot: string, results: ImportResult[]): Promise<void> {
  const content = await readFileSafe(join(projectRoot, KIRO_MCP_FILE));
  if (content === null) return;
  const servers = readMcpServers(content);
  if (Object.keys(servers).length === 0) return;
  await writeFileAtomic(
    join(projectRoot, KIRO_CANONICAL_MCP),
    JSON.stringify({ mcpServers: servers }, null, 2),
  );
  results.push({
    fromTool: KIRO_TARGET,
    fromPath: join(projectRoot, KIRO_MCP_FILE),
    toPath: KIRO_CANONICAL_MCP,
    feature: 'mcp',
  });
}

async function importHooks(projectRoot: string, results: ImportResult[]): Promise<void> {
  const hooks: Hooks = {};
  for (const absPath of await readDirRecursive(join(projectRoot, KIRO_HOOKS_DIR))) {
    if (!absPath.endsWith('.kiro.hook')) continue;
    const parsed = parseKiroHookFile((await readFileSafe(absPath)) ?? '');
    if (!parsed) continue;
    hooks[parsed.event] ??= [];
    hooks[parsed.event]!.push(parsed.entry);
  }
  if (Object.keys(hooks).length === 0) return;
  await writeFileAtomic(join(projectRoot, KIRO_CANONICAL_HOOKS), serializeCanonicalHooks(hooks));
  results.push({
    fromTool: KIRO_TARGET,
    fromPath: join(projectRoot, KIRO_HOOKS_DIR),
    toPath: KIRO_CANONICAL_HOOKS,
    feature: 'hooks',
  });
}

async function importIgnore(projectRoot: string, results: ImportResult[]): Promise<void> {
  const content = await readFileSafe(join(projectRoot, KIRO_IGNORE));
  if (content === null) return;
  await writeFileAtomic(join(projectRoot, KIRO_CANONICAL_IGNORE), content.trimEnd());
  results.push({
    fromTool: KIRO_TARGET,
    fromPath: join(projectRoot, KIRO_IGNORE),
    toPath: KIRO_CANONICAL_IGNORE,
    feature: 'ignore',
  });
}

export async function importFromKiro(projectRoot: string): Promise<ImportResult[]> {
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(KIRO_TARGET, projectRoot);
  await importRoot(projectRoot, results, normalize);
  await importRules(projectRoot, results, normalize);
  await importEmbeddedSkills(projectRoot, KIRO_SKILLS_DIR, KIRO_TARGET, results, normalize);
  await importMcp(projectRoot, results);
  await importHooks(projectRoot, results);
  await importIgnore(projectRoot, results);
  return results;
}
