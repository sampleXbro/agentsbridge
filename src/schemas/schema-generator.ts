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

/**
 * Recursively strip property names that carry a `default` value from every
 * `required` array in a JSON Schema document.
 *
 * Why: Zod 4's `.toJSONSchema()` emits a field marked `required` whenever the
 * source schema has `.default(X)` — Zod considers the default proof of
 * presence. But "the parser supplies a default" is the opposite of "the
 * user MUST provide this value" from an editor's perspective; a minimal
 * `agentsmesh.yaml` of just `version: 1` should validate without errors.
 *
 * We can't reverse the Zod chain (e.g. `.default(X).optional()`) because
 * that flips the inferred TS output to `T | undefined`, which then ripples
 * through every consumer of `ValidatedConfig`. The publishing layer is the
 * right place to fix it: strip these names from `required` so editors see
 * a schema that matches the actual user contract.
 *
 * Walks `properties` / `additionalProperties` / `items` / `anyOf` / `oneOf`
 * / `allOf` so nested shapes are also corrected.
 */
function stripRequiredFromDefaults(schema: unknown): void {
  if (schema === null || typeof schema !== 'object') return;
  if (Array.isArray(schema)) {
    for (const item of schema) stripRequiredFromDefaults(item);
    return;
  }
  const obj = schema as Record<string, unknown>;
  const props = obj.properties as Record<string, unknown> | undefined;
  const required = obj.required as string[] | undefined;
  if (props !== undefined && Array.isArray(required)) {
    const filtered = required.filter((name) => {
      const propSchema = props[name];
      if (propSchema === null || typeof propSchema !== 'object') return true;
      return !('default' in (propSchema as Record<string, unknown>));
    });
    if (filtered.length === 0) {
      delete obj.required;
    } else {
      obj.required = filtered;
    }
  }
  if (props !== undefined) {
    for (const value of Object.values(props)) stripRequiredFromDefaults(value);
  }
  for (const key of ['additionalProperties', 'items', 'patternProperties']) {
    if (key in obj) stripRequiredFromDefaults(obj[key]);
  }
  for (const key of ['anyOf', 'oneOf', 'allOf']) {
    if (key in obj) stripRequiredFromDefaults(obj[key]);
  }
}

function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const result = z.toJSONSchema(schema, OPTS) as Record<string, unknown>;
  stripRequiredFromDefaults(result);
  return result;
}

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
      toJsonSchema(configSchema),
      'agentsmesh.yaml',
      'AgentsMesh configuration file (agentsmesh.yaml / agentsmesh.local.yaml)',
    ),
    permissions: addMeta(
      toJsonSchema(permissionsSchema),
      'agentsmesh-permissions.yaml',
      'AgentsMesh permissions config (.agentsmesh/permissions.yaml)',
    ),
    hooks: addMeta(
      toJsonSchema(hooksSchema),
      'agentsmesh-hooks.yaml',
      'AgentsMesh lifecycle hooks (.agentsmesh/hooks.yaml)',
    ),
    mcp: addMeta(
      toJsonSchema(mcpConfigSchema),
      'agentsmesh-mcp.json',
      'AgentsMesh MCP server config (.agentsmesh/mcp.json)',
    ),
    pack: addMeta(
      toJsonSchema(packMetadataSchema),
      'agentsmesh-pack.yaml',
      'AgentsMesh pack metadata (.agentsmesh/packs/{name}/pack.yaml)',
    ),
    installs: addMeta(
      toJsonSchema(installManifestSchema),
      'agentsmesh-installs.yaml',
      'AgentsMesh install manifest (.agentsmesh/installs.yaml) — tracks every installed pack so `--sync` can replay them post-clone.',
    ),
    'install-manifest': addMeta(
      toJsonSchema(installManifestFileSchema),
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
