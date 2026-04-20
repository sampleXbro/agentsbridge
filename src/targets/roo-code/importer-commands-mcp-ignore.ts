import { join } from 'node:path';
import type { ImportResult, McpServer } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { readFileSafe, writeFileAtomic } from '../../utils/filesystem/fs.js';
import { parseFrontmatter } from '../../utils/text/markdown.js';
import { serializeImportedCommandWithFallback } from '../import/import-metadata.js';
import { importFileDirectory } from '../import/import-orchestrator.js';
import { toStringArray, toStringRecord } from '../import/shared-import-helpers.js';
import {
  ROO_CODE_TARGET,
  ROO_CODE_COMMANDS_DIR,
  ROO_CODE_MCP_FILE,
  ROO_CODE_GLOBAL_MCP_FILE,
  ROO_CODE_IGNORE,
  ROO_CODE_CANONICAL_COMMANDS_DIR,
  ROO_CODE_CANONICAL_MCP,
  ROO_CODE_CANONICAL_IGNORE,
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
        description: typeof server.description === 'string' ? server.description : undefined,
      };
      continue;
    }
    if (typeof server.url === 'string') {
      servers[name] = {
        type: typeof server.type === 'string' ? server.type : 'http',
        url: server.url,
        headers: toStringRecord(server.headers),
        env: toStringRecord(server.env),
        description: typeof server.description === 'string' ? server.description : undefined,
      };
    }
  }
  return servers;
}

export async function importRooCommands(
  projectRoot: string,
  results: ImportResult[],
  normalize: (content: string, sourceFile: string, destinationFile: string) => string,
): Promise<void> {
  const srcDir = join(projectRoot, ROO_CODE_COMMANDS_DIR);
  const destDir = join(projectRoot, ROO_CODE_CANONICAL_COMMANDS_DIR);

  results.push(
    ...(await importFileDirectory({
      srcDir,
      destDir,
      extensions: ['.md'],
      fromTool: ROO_CODE_TARGET,
      normalize,
      mapEntry: async ({ relativePath, normalizeTo }) => {
        const destPath = join(destDir, relativePath);
        const { frontmatter, body } = parseFrontmatter(normalizeTo(destPath));
        const output = await serializeImportedCommandWithFallback(
          destPath,
          {
            hasDescription: true,
            description:
              typeof frontmatter.description === 'string' ? frontmatter.description : undefined,
            hasAllowedTools: false,
            allowedTools: [],
          },
          body,
        );
        return {
          destPath,
          toPath: `${ROO_CODE_CANONICAL_COMMANDS_DIR}/${relativePath}`,
          feature: 'commands',
          content: output,
        };
      },
    })),
  );
}

export async function importRooMcp(
  projectRoot: string,
  results: ImportResult[],
  scope: TargetLayoutScope,
): Promise<void> {
  const srcPath =
    scope === 'global'
      ? join(projectRoot, ROO_CODE_GLOBAL_MCP_FILE)
      : join(projectRoot, ROO_CODE_MCP_FILE);
  const content = await readFileSafe(srcPath);
  if (content === null) return;

  const servers = readMcpServers(content);
  if (Object.keys(servers).length === 0) return;

  await writeFileAtomic(
    join(projectRoot, ROO_CODE_CANONICAL_MCP),
    JSON.stringify({ mcpServers: servers }, null, 2),
  );
  results.push({
    fromTool: ROO_CODE_TARGET,
    fromPath: srcPath,
    toPath: ROO_CODE_CANONICAL_MCP,
    feature: 'mcp',
  });
}

export async function importRooIgnore(projectRoot: string, results: ImportResult[]): Promise<void> {
  const srcPath = join(projectRoot, ROO_CODE_IGNORE);
  const content = await readFileSafe(srcPath);
  if (content === null) return;

  await writeFileAtomic(join(projectRoot, ROO_CODE_CANONICAL_IGNORE), content.trimEnd());
  results.push({
    fromTool: ROO_CODE_TARGET,
    fromPath: srcPath,
    toPath: ROO_CODE_CANONICAL_IGNORE,
    feature: 'ignore',
  });
}
