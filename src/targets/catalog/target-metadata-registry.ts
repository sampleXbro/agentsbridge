/**
 * Target metadata registry — single source of truth for user-facing target data.
 *
 * Aggregates each builtin descriptor's `metadata`, `capabilities` (project + global),
 * and primary import root paths into a single record keyed by target ID. Used by docs
 * and build scripts to render lists, tables, and links without hardcoded enumerations.
 *
 * To add a new target: drop a directory under `src/targets/<id>/` whose `index.ts`
 * exports a `descriptor` with the new `metadata` field. The registry is rebuilt
 * automatically on next module load.
 */
import { BUILTIN_TARGETS, getTargetCapabilities } from './builtin-targets.js';
import { resolveScopedSources } from './import-descriptor.js';
import type {
  TargetDescriptor,
  TargetLayoutScope,
  TargetMetadata,
  TargetCategory,
} from './target-descriptor.js';
import type { TargetCapabilityValue } from './capabilities.js';
import type { BuiltinTargetId } from './target-ids.js';

export interface TargetEntry {
  readonly id: string;
  readonly metadata: TargetMetadata;
  readonly capabilities: {
    readonly project: Record<string, TargetCapabilityValue>;
    readonly global: Record<string, TargetCapabilityValue>;
  };
  readonly importRoot: {
    readonly project?: string;
    readonly global?: string;
  };
}

function importRootForScope(
  descriptor: TargetDescriptor,
  scope: TargetLayoutScope,
): string | undefined {
  const rulesSpec = descriptor.importer?.rules;
  const firstRulesSpec = Array.isArray(rulesSpec) ? rulesSpec[0] : rulesSpec;
  if (firstRulesSpec) {
    const sources = resolveScopedSources(firstRulesSpec.source, scope);
    if (sources[0]) return sources[0];
  }
  const layout = scope === 'global' ? descriptor.globalSupport?.layout : descriptor.project;
  return layout?.rootInstructionPath ?? descriptor.detectionPaths[0];
}

function buildEntry(descriptor: TargetDescriptor): TargetEntry {
  const project = getTargetCapabilities(descriptor.id, 'project') ?? {};
  const global = getTargetCapabilities(descriptor.id, 'global') ?? {};
  return {
    id: descriptor.id,
    metadata: descriptor.metadata,
    capabilities: { project, global },
    importRoot: {
      project: importRootForScope(descriptor, 'project'),
      global: importRootForScope(descriptor, 'global'),
    },
  };
}

function buildRegistry(): Record<string, TargetEntry> {
  const entries: Record<string, TargetEntry> = {};
  for (const descriptor of BUILTIN_TARGETS) {
    entries[descriptor.id] = buildEntry(descriptor);
  }
  return entries;
}

/** Static, deduplicated registry keyed by builtin target ID. */
export const TARGET_REGISTRY: Readonly<Record<BuiltinTargetId, TargetEntry>> = Object.freeze(
  buildRegistry(),
) as Readonly<Record<BuiltinTargetId, TargetEntry>>;

/** Stable alphabetized list of all builtin target entries. */
export function listTargets(): readonly TargetEntry[] {
  return Object.values(TARGET_REGISTRY).sort((a, b) => a.id.localeCompare(b.id));
}

/** Group every target by `metadata.category`. */
export function targetsByCategory(): Record<TargetCategory, readonly TargetEntry[]> {
  const groups: Record<TargetCategory, TargetEntry[]> = {
    cli: [],
    ide: [],
    'agent-platform': [],
  };
  for (const entry of listTargets()) {
    groups[entry.metadata.category].push(entry);
  }
  return groups;
}

/** First import source path for the given scope (undefined if target unknown or has none). */
export function primaryImportRoot(targetId: string, scope: TargetLayoutScope): string | undefined {
  const entry = TARGET_REGISTRY[targetId as BuiltinTargetId];
  if (!entry) return undefined;
  return scope === 'global' ? entry.importRoot.global : entry.importRoot.project;
}
