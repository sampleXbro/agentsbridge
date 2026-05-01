import { extname, join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { ImportResult, McpServer } from '../../core/types.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { readDirRecursive, readFileSafe } from '../../utils/filesystem/fs.js';
import { importEmbeddedSkills } from '../import/embedded-skill.js';
import { runDescriptorImport } from '../import/descriptor-import-runner.js';
import { writeMcpWithMerge } from '../import/mcp-merge.js';
import { toStringArray, toStringRecord } from '../import/shared-import-helpers.js';
import {
  CONTINUE_TARGET,
  CONTINUE_MCP_DIR,
  CONTINUE_SKILLS_DIR,
  CONTINUE_CANONICAL_MCP,
} from './constants.js';
import { descriptor } from './index.js';

function readMcpServers(content: string, extension: string): Record<string, McpServer> {
  const parsed =
    extension === '.json'
      ? (JSON.parse(content) as Record<string, unknown>)
      : ((parseYaml(content) as Record<string, unknown>) ?? {});
  const rawServers = parsed.mcpServers;
  if (!rawServers || typeof rawServers !== 'object' || Array.isArray(rawServers)) return {};
  const servers: Record<string, McpServer> = {};
  for (const [name, value] of Object.entries(rawServers)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const server = value as Record<string, unknown>;
    if (typeof server.command !== 'string') continue;
    servers[name] = {
      type: typeof server.type === 'string' ? server.type : 'stdio',
      command: server.command,
      args: toStringArray(server.args),
      env: toStringRecord(server.env),
      description: typeof server.description === 'string' ? server.description : undefined,
    };
  }
  return servers;
}

/**
 * Continue MCP merges every JSON/YAML file under `.continue/mcpServers/` into a
 * single canonical `mcp.json`. The descriptor runner does not model multi-file
 * merge today, so this stays imperative.
 */
async function importMcp(projectRoot: string, results: ImportResult[]): Promise<void> {
  const files = (await readDirRecursive(join(projectRoot, CONTINUE_MCP_DIR))).filter((file) =>
    ['.json', '.yaml', '.yml'].includes(extname(file)),
  );
  const merged: Record<string, McpServer> = {};
  const importedFrom: string[] = [];
  for (const srcPath of files) {
    const content = await readFileSafe(srcPath);
    if (!content) continue;
    Object.assign(merged, readMcpServers(content, extname(srcPath)));
    importedFrom.push(srcPath);
  }
  if (Object.keys(merged).length === 0) return;
  await writeMcpWithMerge(projectRoot, CONTINUE_CANONICAL_MCP, merged);
  for (const fromPath of importedFrom) {
    results.push({
      fromTool: CONTINUE_TARGET,
      fromPath,
      toPath: CONTINUE_CANONICAL_MCP,
      feature: 'mcp',
    });
  }
}

export async function importFromContinue(projectRoot: string): Promise<ImportResult[]> {
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(CONTINUE_TARGET, projectRoot);
  results.push(...(await runDescriptorImport(descriptor, projectRoot, 'project', { normalize })));
  await importEmbeddedSkills(projectRoot, CONTINUE_SKILLS_DIR, CONTINUE_TARGET, results, normalize);
  await importMcp(projectRoot, results);
  return results;
}
