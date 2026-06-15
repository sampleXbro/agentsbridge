/**
 * Amazon Q Developer importer descriptor — declarative scan+map rules for the
 * shared `runDescriptorImport` orchestrator.
 */

import { basename, join } from 'node:path';
import type { TargetImporterDescriptor } from '../catalog/import-descriptor.js';
import type { ImportEntryContext, ImportEntryMapping } from '../catalog/import-descriptor.js';
import { serializeImportedAgentWithFallback } from '../import/import-metadata.js';
import {
  AMAZON_Q_RULES_DIR,
  AMAZON_Q_MCP_FILE,
  AMAZON_Q_AGENTS_DIR,
  AMAZON_Q_GLOBAL_RULES_DIR,
  AMAZON_Q_GLOBAL_MCP_FILE,
  AMAZON_Q_GLOBAL_AGENTS_DIR,
  AMAZON_Q_CANONICAL_RULES_DIR,
  AMAZON_Q_CANONICAL_MCP,
  AMAZON_Q_CANONICAL_AGENTS_DIR,
} from './constants.js';

/**
 * Maps an Amazon Q `.amazonq/cli-agents/{name}.json` file to a canonical
 * `.agentsmesh/agents/{name}.md` agent file.
 */
async function amazonQAgentMapper(
  ctx: ImportEntryContext,
): Promise<ImportEntryMapping | null> {
  const agentName = basename(ctx.relativePath, '.json');
  const destRelPath = `${agentName}.md`;
  const destPath = join(ctx.destDir, destRelPath);

  let parsed: unknown;
  try {
    parsed = JSON.parse(ctx.content) as unknown;
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const raw = parsed as Record<string, unknown>;

  const name = typeof raw.name === 'string' ? raw.name : agentName;
  const description = typeof raw.description === 'string' ? raw.description : '';
  const tools = Array.isArray(raw.allowedTools)
    ? (raw.allowedTools as unknown[]).filter((t): t is string => typeof t === 'string')
    : [];
  const body = typeof raw.systemPrompt === 'string' ? raw.systemPrompt : '';

  const content = await serializeImportedAgentWithFallback(
    destPath,
    { name, description, tools },
    body,
  );

  return {
    destPath,
    toPath: `${AMAZON_Q_CANONICAL_AGENTS_DIR}/${destRelPath}`,
    content,
  };
}

export const amazonQImporterSpec: TargetImporterDescriptor = {
  rules: {
    feature: 'rules',
    mode: 'directory',
    source: {
      project: [AMAZON_Q_RULES_DIR],
      global: [AMAZON_Q_GLOBAL_RULES_DIR],
    },
    canonicalDir: AMAZON_Q_CANONICAL_RULES_DIR,
    extensions: ['.md'],
    preset: 'rule',
  },
  agents: {
    feature: 'agents',
    mode: 'directory',
    source: {
      project: [AMAZON_Q_AGENTS_DIR],
      global: [AMAZON_Q_GLOBAL_AGENTS_DIR],
    },
    canonicalDir: AMAZON_Q_CANONICAL_AGENTS_DIR,
    extensions: ['.json'],
    map: amazonQAgentMapper,
  },
  mcp: {
    feature: 'mcp',
    mode: 'mcpJson',
    source: {
      project: [AMAZON_Q_MCP_FILE],
      global: [AMAZON_Q_GLOBAL_MCP_FILE],
    },
    canonicalDir: '.agentsmesh',
    canonicalFilename: AMAZON_Q_CANONICAL_MCP,
  },
};
