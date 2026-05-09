/**
 * Crush crush.json config file format helpers.
 *
 * Crush uses a single crush.json for MCP servers, hooks, permissions, and
 * options. Multiple features can co-exist in the same file; this module
 * provides a builder that merges feature payloads into one config object.
 */

export interface CrushConfigShape {
  $schema?: string;
  mcp?: Record<string, unknown>;
  hooks?: Record<string, unknown>;
  permissions?: Record<string, unknown>;
  options?: Record<string, unknown>;
}

/**
 * Build a crush.json config object from feature payloads.
 * Always includes the $schema reference for IDE support.
 */
export function buildCrushConfigJson(
  overrides: Omit<CrushConfigShape, '$schema'>,
): CrushConfigShape {
  return {
    $schema: 'https://charm.land/crush.json',
    ...overrides,
  };
}
