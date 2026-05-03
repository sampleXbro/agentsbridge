/**
 * Import OpenCode config into canonical `.agentsmesh/`.
 *
 * Reads:
 *   - `AGENTS.md`                    — root rule
 *   - `.opencode/rules/*.md`         — additional rules
 *   - `.opencode/commands/*.md`      — slash commands
 *   - `.opencode/agents/*.md`        — custom agents
 *   - `.opencode/skills/`            — skill bundles
 *   - `opencode.json`               — MCP servers from `mcp` key
 *
 * MCP import is custom because OpenCode uses `mcp` (not `mcpServers`)
 * and a different server format (array `command`, `environment` key).
 */

import { join } from 'node:path';
import type { ImportResult } from '../../core/types.js';
import type { McpServer } from '../../core/mcp-types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import { createImportReferenceNormalizer } from '../../core/reference/import-rewriter.js';
import { importEmbeddedSkills } from '../import/embedded-skill.js';
import { runDescriptorImport } from '../import/descriptor-import-runner.js';
import { writeMcpWithMerge } from '../import/mcp-merge.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import {
  OPENCODE_TARGET,
  OPENCODE_SKILLS_DIR,
  OPENCODE_CONFIG_FILE,
  OPENCODE_GLOBAL_CONFIG_FILE,
  OPENCODE_CANONICAL_MCP,
} from './constants.js';
import { descriptor } from './index.js';

function toStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

function parseOpenCodeMcp(content: string): Record<string, McpServer> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const raw = (parsed as Record<string, unknown>).mcp;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, McpServer> = {};
  for (const [name, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const entry = value as Record<string, unknown>;
    if (typeof entry.url === 'string') {
      out[name] = {
        type: 'url',
        url: entry.url,
        headers: toStringRecord(entry.headers),
        env: toStringRecord(entry.environment),
        ...(typeof entry.description === 'string' ? { description: entry.description } : {}),
      };
      continue;
    }
    if (Array.isArray(entry.command) && entry.command.length > 0) {
      const cmdArr = entry.command as string[];
      const command = cmdArr[0];
      if (command === undefined) continue;
      const args = cmdArr.slice(1);
      out[name] = {
        type: 'stdio',
        command,
        args,
        env: toStringRecord(entry.environment),
        ...(typeof entry.description === 'string' ? { description: entry.description } : {}),
      };
    }
  }
  return out;
}

async function importMcp(
  projectRoot: string,
  scope: TargetLayoutScope,
  results: ImportResult[],
): Promise<void> {
  const configFile = scope === 'global' ? OPENCODE_GLOBAL_CONFIG_FILE : OPENCODE_CONFIG_FILE;
  const srcPath = join(projectRoot, configFile);
  const content = await readFileSafe(srcPath);
  if (content === null) return;
  const imported = parseOpenCodeMcp(content);
  if (Object.keys(imported).length === 0) return;
  await writeMcpWithMerge(projectRoot, OPENCODE_CANONICAL_MCP, imported);
  results.push({
    feature: 'mcp',
    fromTool: OPENCODE_TARGET,
    fromPath: srcPath,
    toPath: OPENCODE_CANONICAL_MCP,
  });
}

export async function importFromOpenCode(
  projectRoot: string,
  options: { scope?: TargetLayoutScope } = {},
): Promise<ImportResult[]> {
  const scope = options.scope ?? 'project';
  const results: ImportResult[] = [];
  const normalize = await createImportReferenceNormalizer(OPENCODE_TARGET, projectRoot, scope);

  results.push(...(await runDescriptorImport(descriptor, projectRoot, scope, { normalize })));

  await importEmbeddedSkills(projectRoot, OPENCODE_SKILLS_DIR, OPENCODE_TARGET, results, normalize);

  await importMcp(projectRoot, scope, results);

  return results;
}
