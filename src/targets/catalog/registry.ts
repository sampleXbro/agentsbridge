import type { TargetGenerators } from './target.interface.js';
import type { TargetDescriptor } from './target-descriptor.js';
import { BUILTIN_TARGETS } from './builtin-targets.js';
import { validateDescriptor } from './target-descriptor.schema.js';

const descriptorRegistry = new Map<string, TargetDescriptor>();
const legacyRegistry = new Map<string, TargetGenerators>();

let _builtinDescriptors: Map<string, TargetDescriptor> | undefined;
function builtinDescriptors(): Map<string, TargetDescriptor> {
  if (_builtinDescriptors) return _builtinDescriptors;
  // Filter undefined slots: when a descriptor's path callback transitively
  // looks up another descriptor during the circular-import resolution
  // window (e.g. cline's `agentPath` → `shouldConvertAgentsToSkills` →
  // `getDescriptor`), BUILTIN_TARGETS may temporarily contain TDZ holes.
  // Don't cache until every slot is populated, so the next call after
  // module load completes gets a full map.
  const defined = BUILTIN_TARGETS.filter(
    (d): d is TargetDescriptor => d !== undefined && typeof d.id === 'string',
  );
  const map = new Map(defined.map((d) => [d.id, d]));
  if (defined.length === BUILTIN_TARGETS.length) {
    _builtinDescriptors = map;
  }
  return map;
}

/** Register a full target descriptor (for plugins). */
export function registerTargetDescriptor(descriptor: TargetDescriptor): void {
  const validated = validateDescriptor(descriptor);
  descriptorRegistry.set(validated.id, validated);
}

/** Register generators only (backward compat). */
export function registerTarget(target: TargetGenerators): void {
  legacyRegistry.set(target.name, target);
}

/** Look up a full descriptor by target ID. */
export function getDescriptor(name: string): TargetDescriptor | undefined {
  return descriptorRegistry.get(name) ?? builtinDescriptors().get(name);
}

/** Look up generators by target name. Falls through descriptors → legacy. */
export function getTarget(name: string): TargetGenerators {
  const descriptor = getDescriptor(name);
  if (descriptor) return descriptor.generators;
  const legacy = legacyRegistry.get(name);
  if (legacy) return legacy;
  throw new Error(`Unknown target: ${name}`);
}

export function getAllDescriptors(): TargetDescriptor[] {
  return [...descriptorRegistry.values()];
}

export function getAllTargets(): TargetGenerators[] {
  return [...legacyRegistry.values()];
}

export function resetRegistry(): void {
  descriptorRegistry.clear();
  legacyRegistry.clear();
}
