/**
 * Descriptor-driven importer contract.
 *
 * Each target may declare an `importer: TargetImporterDescriptor` block on its
 * descriptor. The shared runner walks the spec, resolves sources for the active
 * scope, and dispatches to existing helpers (`importFileDirectory`,
 * `importDirectorySkill`, …). Scope variance is expressed as data — features
 * with no `global` source are silently skipped in global mode, eliminating the
 * `if (scope === 'global')` branches that previously leaked into importer bodies.
 *
 * Targets with custom parsing (codex-cli rule splitter, windsurf workflows,
 * gemini-cli policies) keep their own `generators.importFrom` and may also
 * delegate the declarable parts of their flow to the runner.
 */

import type { TargetLayoutScope } from './target-descriptor.js';

/**
 * Per-scope source paths. Omit `global` to make the feature project-only — the
 * runner skips it under `--global` instead of every importer guarding with
 * `if (scope === 'global')`.
 */
export interface ImportSourcePaths {
  readonly project?: readonly string[];
  readonly global?: readonly string[];
}

export type ImportFeatureKind =
  | 'rules'
  | 'commands'
  | 'agents'
  | 'skills'
  | 'mcp'
  | 'hooks'
  | 'permissions'
  | 'ignore';

/**
 * Mapping modes:
 *  - `singleFile`  — try each `source` path in order, take the first that
 *                    exists, write to `${canonicalDir}/${canonicalRootFilename}`.
 *                    Used for root rule files (`AGENTS.md`, `CLAUDE.md`, …).
 *  - `directory`   — recurse `source` paths and run a per-entry mapper. Built
 *                    on top of the existing `importFileDirectory` helper.
 *  - `flatFile`    — copy a single file verbatim (with `trimEnd`) to a fixed
 *                    canonical destination. Used for `ignore`.
 *  - `mcpJson`     — parse a JSON MCP servers file and write canonical
 *                    `mcp.json`.
 */
export type ImportFeatureMode = 'singleFile' | 'directory' | 'flatFile' | 'mcpJson';

export type ContentNormalizer = (
  content: string,
  sourceFile: string,
  destinationFile: string,
) => string;

export interface ImportEntryContext {
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly content: string;
  readonly destDir: string;
  readonly normalizeTo: (destinationFile: string) => string;
}

export interface ImportEntryMapping {
  readonly destPath: string;
  readonly toPath: string;
  readonly content: string;
}

export type ImportEntryMapper = (
  ctx: ImportEntryContext,
) => Promise<ImportEntryMapping | null> | ImportEntryMapping | null;

/** Optional declarative frontmatter post-processing for the default mappers. */
export type FrontmatterRemap = (frontmatter: Record<string, unknown>) => Record<string, unknown>;

export interface ImportFeatureSpec {
  readonly feature: ImportFeatureKind;
  readonly mode: ImportFeatureMode;
  readonly source: ImportSourcePaths;
  /** Tried after `source` in the same scope when the primary chain finds nothing (singleFile only). */
  readonly fallbacks?: ImportSourcePaths;
  /** Canonical destination directory under the project root (e.g. `.agentsmesh/rules`). */
  readonly canonicalDir: string;
  /** For `singleFile` only: the destination filename inside `canonicalDir`. */
  readonly canonicalRootFilename?: string;
  /** For `directory` mode: file extensions to match (`['.md']`, `['.mdc']`, …). */
  readonly extensions?: readonly string[];
  /** For `directory` mode: pick a built-in mapper. */
  readonly preset?: 'rule' | 'command' | 'agent';
  /** Optional frontmatter post-processing applied by built-in mappers. */
  readonly frontmatterRemap?: FrontmatterRemap;
  /** Custom mapper. Wins over `preset` when both are set. */
  readonly map?: ImportEntryMapper;
  /** For `singleFile` rules: marks the imported entry as a root rule (`root: true`). */
  readonly markAsRoot?: boolean;
  /** For `flatFile` and `mcpJson`: canonical destination filename. */
  readonly canonicalFilename?: string;
}

export interface TargetImporterDescriptor {
  readonly rules?: ImportFeatureSpec | readonly ImportFeatureSpec[];
  readonly commands?: ImportFeatureSpec;
  readonly agents?: ImportFeatureSpec;
  readonly skills?: ImportFeatureSpec;
  readonly mcp?: ImportFeatureSpec;
  readonly hooks?: ImportFeatureSpec;
  readonly permissions?: ImportFeatureSpec;
  readonly ignore?: ImportFeatureSpec;
}

export const IMPORT_FEATURE_ORDER: readonly ImportFeatureKind[] = [
  'rules',
  'commands',
  'agents',
  'skills',
  'mcp',
  'hooks',
  'permissions',
  'ignore',
];

export function resolveScopedSources(
  paths: ImportSourcePaths | undefined,
  scope: TargetLayoutScope,
): readonly string[] {
  if (!paths) return [];
  return paths[scope] ?? [];
}
