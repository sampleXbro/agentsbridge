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
 *
 * Round-trips the `hooks` key: Amazon Q trigger names (preToolUse, postToolUse,
 * userPromptSubmit) are written verbatim into the canonical agent frontmatter so
 * that re-generating re-embeds the same hooks without data loss.
 */
async function amazonQAgentMapper(ctx: ImportEntryContext): Promise<ImportEntryMapping | null> {
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
  // Amazon Q's agent-v1.json schema uses `prompt`; accept the legacy `systemPrompt`
  // key as a fallback so previously generated agent files still round-trip.
  const body =
    typeof raw.prompt === 'string'
      ? raw.prompt
      : typeof raw.systemPrompt === 'string'
        ? raw.systemPrompt
        : '';

  // Preserve the hooks key (Amazon Q trigger names) verbatim so a re-generate
  // re-embeds the same hooks without data loss.
  const hooks =
    raw.hooks && typeof raw.hooks === 'object' && !Array.isArray(raw.hooks)
      ? (raw.hooks as Record<string, unknown>)
      : undefined;

  const frontmatter: Record<string, unknown> = { name, description, tools };
  if (hooks !== undefined) frontmatter.hooks = hooks;

  const content = await serializeImportedAgentWithFallback(destPath, frontmatter, body);

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
