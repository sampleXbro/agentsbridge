/**
 * Builds all JSON Schema objects from Zod source schemas.
 * Used by both the generation script and the freshness tests.
 */

import { z } from 'zod';
import { configSchema } from '../config/core/schema.js';
import { installManifestSchema } from '../install/core/install-manifest.js';
import { packMetadataSchema } from '../install/pack/pack-schema.js';
import { installManifestFileSchema } from '../install/manifest/install-manifest-hash.js';
import { permissionsSchema, hooksSchema, mcpConfigSchema } from './canonical-schemas.js';

const OPTS = { unrepresentable: 'any' } as const;

export interface AllSchemas {
  agentsmesh: Record<string, unknown>;
  permissions: Record<string, unknown>;
  hooks: Record<string, unknown>;
  mcp: Record<string, unknown>;
  pack: Record<string, unknown>;
  installs: Record<string, unknown>;
  'install-manifest': Record<string, unknown>;
}

/** Generate all JSON Schema objects from their Zod counterparts. */
export function buildAllSchemas(): AllSchemas {
  return {
    agentsmesh: addMeta(
      z.toJSONSchema(configSchema, OPTS),
      'agentsmesh.yaml',
      'AgentsMesh configuration file (agentsmesh.yaml / agentsmesh.local.yaml)',
    ),
    permissions: addMeta(
      z.toJSONSchema(permissionsSchema, OPTS),
      'agentsmesh-permissions.yaml',
      'AgentsMesh permissions config (.agentsmesh/permissions.yaml)',
    ),
    hooks: addMeta(
      z.toJSONSchema(hooksSchema, OPTS),
      'agentsmesh-hooks.yaml',
      'AgentsMesh lifecycle hooks (.agentsmesh/hooks.yaml)',
    ),
    mcp: addMeta(
      z.toJSONSchema(mcpConfigSchema, OPTS),
      'agentsmesh-mcp.json',
      'AgentsMesh MCP server config (.agentsmesh/mcp.json)',
    ),
    pack: addMeta(
      z.toJSONSchema(packMetadataSchema, OPTS),
      'agentsmesh-pack.yaml',
      'AgentsMesh pack metadata (.agentsmesh/packs/{name}/pack.yaml)',
    ),
    installs: addMeta(
      z.toJSONSchema(installManifestSchema, OPTS),
      'agentsmesh-installs.yaml',
      'AgentsMesh install manifest (.agentsmesh/installs.yaml) — tracks every installed pack so `--sync` can replay them post-clone.',
    ),
    'install-manifest': addMeta(
      z.toJSONSchema(installManifestFileSchema, OPTS),
      'agentsmesh-install-manifest.json',
      'Per-pack integrity manifest (.agentsmesh/packs/{name}/.agentsmesh-install-manifest.json) — install-time provenance + per-file sha256 map used by `uninstall` to detect locally-modified files before deleting.',
    ),
  };
}

function addMeta(
  schema: Record<string, unknown>,
  title: string,
  description: string,
): Record<string, unknown> {
  return { ...schema, title, description };
}
