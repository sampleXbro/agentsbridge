/**
 * IDE-recognizable schema-directive helpers.
 *
 * Every YAML / JSON file agentsmesh writes is shaped by one of the published
 * Zod schemas in `schemas/`. To let editors (VSCode + Red Hat YAML extension,
 * JetBrains IDEs, vim/neovim + yaml-language-server / coc-json, etc.) wire up
 * autocomplete and validation without any IDE configuration, the writers
 * stamp each file with a self-describing schema reference:
 *
 *   - YAML files get a top-of-file comment recognized by the
 *     `yaml-language-server` protocol:
 *
 *         # yaml-language-server: $schema=https://unpkg.com/agentsmesh@<ver>/schemas/<name>.json
 *         version: 1
 *         ...
 *
 *   - JSON files get a top-level `$schema` field that every modern editor
 *     auto-detects.
 *
 * URLs are pinned to the running package version so the schema referenced
 * always matches the format the file was written with. Upgrading agentsmesh
 * upgrades the URL on the next write; older files keep working pointed at
 * their original schema until the writer touches them again.
 *
 * Use `prependYamlSchemaDirective(yaml, name)` from any writer that emits
 * `yamlStringify(...)` output, and `jsonSchemaUrl(name)` when assembling the
 * JSON object before stringify.
 */

import { getVersion } from '../../cli/version.js';

export type SchemaName =
  | 'agentsmesh'
  | 'permissions'
  | 'hooks'
  | 'pack'
  | 'installs'
  | 'mcp'
  | 'install-manifest';

const SCHEMA_DIRECTIVE_RE = /^# yaml-language-server: \$schema=[^\n]*\n?/;

function schemaBaseUrl(): string {
  // Embedded build constant or runtime-resolved package version. Falls back
  // to `latest` (rather than `unknown`) when the version cannot be read, so
  // editors still recognize the schema even from a dev-mode build.
  const version = getVersion();
  const safeVersion = version && version !== 'unknown' ? `@${version}` : '';
  return `https://unpkg.com/agentsmesh${safeVersion}/schemas`;
}

/** Public URL to the published JSON Schema for the given file format. */
export function schemaUrl(name: SchemaName): string {
  return `${schemaBaseUrl()}/${name}.json`;
}

/** Build the `# yaml-language-server:` directive line (with trailing newline). */
export function yamlSchemaDirective(name: SchemaName): string {
  return `# yaml-language-server: $schema=${schemaUrl(name)}\n`;
}

/**
 * Prepend (or refresh) the `# yaml-language-server:` directive on a YAML
 * payload. Idempotent: if the input already starts with the directive
 * (regardless of URL), the existing line is replaced with the current one.
 * Otherwise the directive is inserted at the very top.
 */
export function prependYamlSchemaDirective(yaml: string, name: SchemaName): string {
  const directive = yamlSchemaDirective(name);
  if (SCHEMA_DIRECTIVE_RE.test(yaml)) {
    return yaml.replace(SCHEMA_DIRECTIVE_RE, directive);
  }
  return `${directive}${yaml}`;
}

/**
 * Stamp the top-level `$schema` field on a JSON document before stringify.
 *
 * Pure: returns a NEW object with `$schema` as the first key, leaving the
 * original untouched. Existing `$schema` values are overwritten with the
 * current pinned URL.
 */
export function stampJsonSchemaField<T extends Record<string, unknown>>(
  payload: T,
  name: SchemaName,
): { $schema: string } & T {
  const { $schema: _ignored, ...rest } = payload;
  void _ignored;
  return { $schema: schemaUrl(name), ...(rest as T) };
}
