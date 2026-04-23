/**
 * Builds all JSON Schema objects from Zod source schemas.
 * Used by both the generation script and the freshness tests.
 */

import { z } from 'zod';
import { configSchema } from '../config/core/schema.js';
import { packMetadataSchema } from '../install/pack/pack-schema.js';
import { permissionsSchema, hooksSchema, mcpConfigSchema } from './canonical-schemas.js';

const OPTS = { unrepresentable: 'any' } as const;

export interface AllSchemas {
  agentsmesh: Record<string, unknown>;
  permissions: Record<string, unknown>;
  hooks: Record<string, unknown>;
  mcp: Record<string, unknown>;
  pack: Record<string, unknown>;
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
  };
}

function addMeta(
  schema: Record<string, unknown>,
  title: string,
  description: string,
): Record<string, unknown> {
  return { ...schema, title, description };
}
