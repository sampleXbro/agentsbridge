import { posix } from 'node:path';
import type { CanonicalFiles } from '../types.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import type { TargetLayoutScope } from '../../targets/catalog/target-descriptor.js';
import { getTargetLayout } from '../../targets/catalog/builtin-targets.js';

export function ruleTargetPath(
  target: string,
  rule: CanonicalFiles['rules'][number],
  scope: TargetLayoutScope = 'project',
): string | null {
  const layout = getTargetLayout(target, scope);
  if (!layout) return null;
  if (rule.root) {
    return layout.rootInstructionPath ?? null;
  }
  if (rule.targets.length > 0 && !rule.targets.includes(target)) return null;

  const slug = posix.basename(rule.source.replace(/\\/g, '/'), '.md');
  return layout.paths.rulePath(slug, rule);
}

export function commandTargetPath(
  target: string,
  name: string,
  config: ValidatedConfig,
  scope: TargetLayoutScope = 'project',
): string | null {
  const layout = getTargetLayout(target, scope);
  if (!layout) return null;
  return layout.paths.commandPath(name, config);
}

export function agentTargetPath(
  target: string,
  name: string,
  config: ValidatedConfig,
  scope: TargetLayoutScope = 'project',
): string | null {
  const layout = getTargetLayout(target, scope);
  if (!layout) return null;
  return layout.paths.agentPath(name, config);
}
