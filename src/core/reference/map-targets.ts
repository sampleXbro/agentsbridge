import { basename } from 'node:path';
import type { CanonicalFiles } from '../types.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import {
  TARGET_IDS,
  getBuiltinTargetDefinition,
  getTargetSkillDir,
} from '../../targets/catalog/builtin-targets.js';

export const SKILL_DIRS: Record<string, string> = Object.fromEntries(
  TARGET_IDS.map((target) => [target, getTargetSkillDir(target)]).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  ),
) as Record<string, string>;

export function ruleTargetPath(
  target: string,
  rule: CanonicalFiles['rules'][number],
): string | null {
  const def = getBuiltinTargetDefinition(target);
  if (!def) return null;
  if (rule.root) {
    return def.generators.primaryRootInstructionPath ?? null;
  }
  if (rule.targets.length > 0 && !rule.targets.includes(target)) return null;

  const slug = basename(rule.source, '.md');
  return def.paths.rulePath(slug, rule);
}

export function commandTargetPath(
  target: string,
  name: string,
  config: ValidatedConfig,
): string | null {
  const def = getBuiltinTargetDefinition(target);
  if (!def) return null;
  return def.paths.commandPath(name, config);
}

export function agentTargetPath(
  target: string,
  name: string,
  config: ValidatedConfig,
): string | null {
  const def = getBuiltinTargetDefinition(target);
  if (!def) return null;
  return def.paths.agentPath(name, config);
}
