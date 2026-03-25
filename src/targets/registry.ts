import type { TargetGenerators } from './target.interface.js';

const registry = new Map<string, TargetGenerators>();

export function registerTarget(target: TargetGenerators): void {
  registry.set(target.name, target);
}

export function getTarget(name: string): TargetGenerators {
  const target = registry.get(name);
  if (!target) throw new Error(`Unknown target: ${name}`);
  return target;
}

export function getAllTargets(): TargetGenerators[] {
  return [...registry.values()];
}

export function resetRegistry(): void {
  registry.clear();
}
