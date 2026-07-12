/**
 * Import Cline agents from the combined `.cline/agents.yaml` file (CLI docs:
 * a single project-only file, not a directory) back into canonical
 * `.agentsmesh/agents/<name>.md` files — one per YAML `agents[]` entry.
 */

import { join } from 'node:path';
import { parse as yamlParse } from 'yaml';
import type { ImportResult } from '../../core/types.js';
import { readFileSafe, writeFileAtomic, mkdirp } from '../../utils/filesystem/fs.js';
import { serializeImportedAgentWithFallback } from '../import/import-metadata.js';
import { CLINE_TARGET, CLINE_AGENTS_FILE, CLINE_CANONICAL_AGENTS_DIR } from './constants.js';

type Normalize = (content: string, sourceFile: string, destinationFile: string) => string;

const EXTENSION_KEYS: Record<string, string> = {
  'x-agentsmesh-disallowed-tools': 'disallowedTools',
  'x-agentsmesh-permission-mode': 'permissionMode',
  'x-agentsmesh-max-turns': 'maxTurns',
  'x-agentsmesh-mcp-servers': 'mcpServers',
  'x-agentsmesh-hooks': 'hooks',
  'x-agentsmesh-skills': 'skills',
  'x-agentsmesh-memory': 'memory',
};

function toCanonicalFrontmatter(entry: Record<string, unknown>): Record<string, unknown> {
  const canonicalFrontmatter: Record<string, unknown> = {
    name: entry.name,
    description: typeof entry.description === 'string' ? entry.description : undefined,
    model: typeof entry.model === 'string' ? entry.model : undefined,
    tools: Array.isArray(entry.tools) ? entry.tools : undefined,
  };
  for (const [extensionKey, canonicalKey] of Object.entries(EXTENSION_KEYS)) {
    if (Object.prototype.hasOwnProperty.call(entry, extensionKey)) {
      canonicalFrontmatter[canonicalKey] = entry[extensionKey];
    }
  }
  Object.keys(canonicalFrontmatter).forEach((key) => {
    if (canonicalFrontmatter[key] === undefined) delete canonicalFrontmatter[key];
  });
  return canonicalFrontmatter;
}

/**
 * @param projectRoot - Project root directory
 * @param results - Import results accumulator
 * @param normalize - Reference normalizer for cross-file link rewriting
 */
export async function importClineAgents(
  projectRoot: string,
  results: ImportResult[],
  normalize: Normalize,
): Promise<void> {
  const srcPath = join(projectRoot, CLINE_AGENTS_FILE);
  const content = await readFileSafe(srcPath);
  if (content === null) return;

  let parsed: unknown;
  try {
    parsed = yamlParse(content);
  } catch {
    return;
  }
  const list = (parsed as { agents?: unknown } | null)?.agents;
  if (!Array.isArray(list)) return;

  const destDir = join(projectRoot, CLINE_CANONICAL_AGENTS_DIR);
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const name = typeof record.name === 'string' && record.name ? record.name : null;
    if (!name) continue;

    const destPath = join(destDir, `${name}.md`);
    const body = typeof record.prompt === 'string' ? record.prompt : '';
    const fileContent = await serializeImportedAgentWithFallback(
      destPath,
      toCanonicalFrontmatter(record),
      normalize(body, srcPath, destPath),
    );
    await mkdirp(destDir);
    await writeFileAtomic(destPath, fileContent);
    results.push({
      fromTool: CLINE_TARGET,
      fromPath: srcPath,
      toPath: `${CLINE_CANONICAL_AGENTS_DIR}/${name}.md`,
      feature: 'agents',
    });
  }
}
