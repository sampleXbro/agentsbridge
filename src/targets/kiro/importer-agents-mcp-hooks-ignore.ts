import { join } from 'node:path';
import type { ImportResult, Hooks, McpServer } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { importFileDirectory } from '../import/import-orchestrator.js';
import { serializeImportedAgentWithFallback } from '../import/import-metadata.js';
import { toStringArray, toStringRecord } from '../import/shared-import-helpers.js';
import { readDirRecursive, readFileSafe, writeFileAtomic } from '../../utils/filesystem/fs.js';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import { parseKiroHookFile, serializeCanonicalHooks } from './hook-format.js';
import {
  KIRO_TARGET,
  KIRO_AGENTS_DIR,
  KIRO_HOOKS_DIR,
  KIRO_MCP_FILE,
  KIRO_GLOBAL_MCP_FILE,
  KIRO_IGNORE,
  KIRO_GLOBAL_IGNORE,
  KIRO_CANONICAL_AGENTS_DIR,
  KIRO_CANONICAL_MCP,
  KIRO_CANONICAL_HOOKS,
  KIRO_CANONICAL_IGNORE,
} from './constants.js';

type NormalizeFn = (content: string, sourceFile: string, destinationFile: string) => string;

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

export async function importKiroAgents(
  projectRoot: string,
  results: ImportResult[],
  normalize: NormalizeFn,
): Promise<void> {
  const srcDir = join(projectRoot, KIRO_AGENTS_DIR);
  const destDir = join(projectRoot, KIRO_CANONICAL_AGENTS_DIR);
  results.push(
    ...(await importFileDirectory({
      srcDir,
      destDir,
      extensions: ['.md'],
      fromTool: KIRO_TARGET,
      normalize,
      mapEntry: async ({ relativePath, normalizeTo }) => {
        const destPath = join(destDir, relativePath);
        const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
        return {
          destPath,
          toPath: `${KIRO_CANONICAL_AGENTS_DIR}/${relativePath}`,
          feature: 'agents',
          content: await serializeImportedAgentWithFallback(destPath, frontmatter, body),
        };
      },
    })),
  );
}

export async function importKiroMcp(
  projectRoot: string,
  results: ImportResult[],
  scope: TargetLayoutScope,
): Promise<void> {
  const mcpRel = scope === 'global' ? KIRO_GLOBAL_MCP_FILE : KIRO_MCP_FILE;
  const content = await readFileSafe(join(projectRoot, mcpRel));
  if (content === null) return;
  const servers = readMcpServers(content);
  if (Object.keys(servers).length === 0) return;
  await writeFileAtomic(
    join(projectRoot, KIRO_CANONICAL_MCP),
    JSON.stringify({ mcpServers: servers }, null, 2),
  );
  results.push({
    fromTool: KIRO_TARGET,
    fromPath: join(projectRoot, mcpRel),
    toPath: KIRO_CANONICAL_MCP,
    feature: 'mcp',
  });
}

export async function importKiroHooks(projectRoot: string, results: ImportResult[]): Promise<void> {
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

export async function importKiroIgnore(
  projectRoot: string,
  results: ImportResult[],
  scope: TargetLayoutScope,
): Promise<void> {
  const ignoreRel = scope === 'global' ? KIRO_GLOBAL_IGNORE : KIRO_IGNORE;
  const content = await readFileSafe(join(projectRoot, ignoreRel));
  if (content === null) return;
  await writeFileAtomic(join(projectRoot, KIRO_CANONICAL_IGNORE), content.trimEnd());
  results.push({
    fromTool: KIRO_TARGET,
    fromPath: join(projectRoot, ignoreRel),
    toPath: KIRO_CANONICAL_IGNORE,
    feature: 'ignore',
  });
}
