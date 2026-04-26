/**
 * Descriptor-driven extra rule→output paths for reference source mapping.
 */

import { basename } from 'node:path';
import type { CanonicalFiles } from '../../core/types.js';
import type { TargetLayoutScope } from './target-descriptor.js';
import { getTargetLayout } from './builtin-targets.js';
import { getAdditionalRootDecorationPaths } from './layout-outputs.js';

function pushUnique(paths: string[], path: string | undefined): void {
  if (path !== undefined && path.length > 0 && !paths.includes(path)) paths.push(path);
}

/**
 * Extra output paths for a canonical rule beyond the primary `refs` map entry.
 */
export function extraRuleOutputPaths(
  target: string,
  rule: CanonicalFiles['rules'][number],
  refs: Map<string, string>,
  scope: TargetLayoutScope,
): string[] {
  const paths: string[] = [];
  const targetPath = refs.get(`.agentsmesh/rules/${basename(rule.source)}`);
  pushUnique(paths, targetPath);

  const layout = getTargetLayout(target, scope);
  if (rule.root) {
    for (const mirrorPath of getAdditionalRootDecorationPaths(layout)) {
      pushUnique(paths, mirrorPath);
    }
  }

  for (const path of layout?.extraRuleOutputPaths?.(rule, { refs, scope }) ?? []) {
    pushUnique(paths, path);
  }

  return paths;
}
