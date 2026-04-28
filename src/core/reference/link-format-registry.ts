/**
 * Link format registry — single source of truth for the three pieces of
 * extension-shaped data the link rebaser needs to know about:
 *
 *   1. `rootRelativePrefixes` — tool dotfile prefixes (`.claude/`, `.github/`,
 *      `.agentsmesh/`, …). Auto-derived from every builtin descriptor's
 *      detection paths and managed outputs, so adding a new builtin target
 *      contributes here without any edit in `src/core/reference/`.
 *
 *   2. `meshRootSegments` — top-level segments under canonical `.agentsmesh/`
 *      (`skills`, `rules`, `commands`, `agents`, `packs`). These are intrinsic
 *      to the canonical model and are intentionally hard-coded as defaults;
 *      plugins can extend them if they introduce new canonical surfaces.
 *
 *   3. `protectedSchemes` — URI / scheme patterns the rewriter must never
 *      touch (`http://`, `ssh://`, `git@host:`, email). Plugins can add their
 *      own (e.g. `notion://`) via `registerLinkFormat`.
 *
 * Plugins call `registerLinkFormat({ ... })` at startup; everything is
 * additive (no override-replace semantics) so plugin order is irrelevant.
 */

import type { TargetDescriptor } from '../../targets/catalog/target-descriptor.js';
import { BUILTIN_TARGETS } from '../../targets/catalog/builtin-targets.js';

export interface LinkFormatRegistry {
  /** URI / scheme patterns that must never be rewritten as paths. */
  readonly protectedSchemes: readonly RegExp[];
  /** Tool dotfile prefixes (always trailing-slashed) that anchor links to project root. */
  readonly rootRelativePrefixes: readonly string[];
  /** Top-level directories under canonical `.agentsmesh/`. */
  readonly meshRootSegments: ReadonlySet<string>;
}

export const DEFAULT_PROTECTED_SCHEMES: readonly RegExp[] = [
  /\b[A-Za-z][A-Za-z0-9+.-]+:[^\s<>()\]]+/g,
  /\b[\w.-]+@[\w.-]+:[^\s<>()\]]+/g,
  /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g,
  /\/\/[A-Za-z0-9][\w.-]*\.[A-Za-z]{2,}[^\s<>()\]]*/g,
];

export const DEFAULT_MESH_ROOT_SEGMENTS: ReadonlySet<string> = new Set([
  'skills',
  'rules',
  'commands',
  'agents',
  'packs',
]);

const overrides: {
  protectedSchemes: RegExp[];
  rootRelativePrefixes: string[];
  meshRootSegments: string[];
} = {
  protectedSchemes: [],
  rootRelativePrefixes: [],
  meshRootSegments: [],
};

let cached: LinkFormatRegistry | undefined;

function topLevelDotfilePrefixes(descriptor: TargetDescriptor): Iterable<string> {
  const layouts = [descriptor.project, descriptor.globalSupport?.layout].filter(
    (l): l is NonNullable<typeof l> => l !== undefined,
  );
  const candidates = [
    ...descriptor.detectionPaths,
    ...layouts.flatMap((l) => l.managedOutputs?.dirs ?? []),
    ...layouts.flatMap((l) => l.managedOutputs?.files ?? []),
  ];
  const out = new Set<string>();
  for (const candidate of candidates) {
    const top = candidate.split('/')[0];
    if (top && top.startsWith('.') && top.length > 1) out.add(`${top}/`);
  }
  return out;
}

function buildDefaultRootRelativePrefixes(): readonly string[] {
  const set = new Set<string>(['.agentsmesh/']);
  for (const descriptor of BUILTIN_TARGETS) {
    for (const prefix of topLevelDotfilePrefixes(descriptor)) set.add(prefix);
  }
  return Array.from(set);
}

function rebuild(): LinkFormatRegistry {
  const rootPrefixSet = new Set<string>([
    ...buildDefaultRootRelativePrefixes(),
    ...overrides.rootRelativePrefixes,
  ]);
  const meshSet = new Set<string>([...DEFAULT_MESH_ROOT_SEGMENTS, ...overrides.meshRootSegments]);
  return {
    protectedSchemes: [...DEFAULT_PROTECTED_SCHEMES, ...overrides.protectedSchemes],
    rootRelativePrefixes: Array.from(rootPrefixSet),
    meshRootSegments: meshSet,
  };
}

export function getLinkFormatRegistry(): LinkFormatRegistry {
  if (!cached) cached = rebuild();
  return cached;
}

/** Add link-format extensions. Always additive; never replaces existing entries. */
export function registerLinkFormat(plugin: {
  readonly protectedSchemes?: readonly RegExp[];
  readonly rootRelativePrefixes?: readonly string[];
  readonly meshRootSegments?: readonly string[];
}): void {
  if (plugin.protectedSchemes) overrides.protectedSchemes.push(...plugin.protectedSchemes);
  if (plugin.rootRelativePrefixes)
    overrides.rootRelativePrefixes.push(...plugin.rootRelativePrefixes);
  if (plugin.meshRootSegments) overrides.meshRootSegments.push(...plugin.meshRootSegments);
  cached = undefined;
}

/** Test helper: drop every plugin contribution and rebuild from defaults. */
export function resetLinkFormatOverrides(): void {
  overrides.protectedSchemes.length = 0;
  overrides.rootRelativePrefixes.length = 0;
  overrides.meshRootSegments.length = 0;
  cached = undefined;
}
