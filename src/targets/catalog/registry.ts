import type { TargetGenerators } from './target.interface.js';
import { BUILTIN_TARGETS } from './builtin-targets.js';

const registry = new Map<string, TargetGenerators>();
const builtins = new Map<string, TargetGenerators>(
  BUILTIN_TARGETS.map((target) => [target.id, target.generators]),
);

export function registerTarget(target: TargetGenerators): void {
  registry.set(target.name, target);
}

export function getTarget(name: string): TargetGenerators {
  const target = registry.get(name) ?? builtins.get(name);
  if (!target) throw new Error(`Unknown target: ${name}`);
  return target;
}

export function getAllTargets(): TargetGenerators[] {
  return [...registry.values()];
}

export function resetRegistry(): void {
  registry.clear();
}
