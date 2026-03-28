import type { TargetGenerators } from './target.interface.js';
import type { TargetDescriptor } from './target-descriptor.js';
import { BUILTIN_TARGETS } from './builtin-targets.js';

const descriptorRegistry = new Map<string, TargetDescriptor>();
const legacyRegistry = new Map<string, TargetGenerators>();

const builtinDescriptors = new Map<string, TargetDescriptor>(BUILTIN_TARGETS.map((d) => [d.id, d]));

/** Register a full target descriptor (for plugins). */
export function registerTargetDescriptor(descriptor: TargetDescriptor): void {
  descriptorRegistry.set(descriptor.id, descriptor);
}

/** Register generators only (backward compat). */
export function registerTarget(target: TargetGenerators): void {
  legacyRegistry.set(target.name, target);
}

/** Look up a full descriptor by target ID. */
export function getDescriptor(name: string): TargetDescriptor | undefined {
  return descriptorRegistry.get(name) ?? builtinDescriptors.get(name);
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
