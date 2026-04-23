/**
 * Target-specific extra rule→output paths for reference source mapping.
 * Lives in `src/targets/catalog` so `src/core/reference/output-source-map.ts` stays target-id free.
 */

import type { CanonicalFiles } from '../../core/types.js';
import { GEMINI_COMPAT_AGENTS } from '../gemini-cli/constants.js';
import { CODEX_RULES_DIR } from '../codex-cli/constants.js';
import type { TargetLayoutScope } from './target-descriptor.js';
import { getTargetLayout } from './builtin-targets.js';
import { getAdditionalRootDecorationPaths } from './layout-outputs.js';

function directoryScopedRuleDir(globs: string[]): string | null {
  if (globs.length === 0) return null;
  const dirs = globs
    .map((glob) => glob.split('/')[0] ?? '')
    .filter((segment) => /^[A-Za-z0-9._-]+$/.test(segment));
  if (dirs.length !== globs.length) return null;
  return dirs.every((dir) => dir === dirs[0]) ? dirs[0]! : null;
}

function copilotInstructionsPath(rule: CanonicalFiles['rules'][number]): string {
  const slug = rule.source.split('/').pop()!.replace(/\.md$/, '');
  return `.github/instructions/${slug}.instructions.md`;
}

function pushUnique(paths: string[], path: string | undefined): void {
  if (path && !paths.includes(path)) paths.push(path);
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
  const targetPath = refs.get(`.agentsmesh/rules/${rule.source.split('/').pop()!}`);
  pushUnique(paths, targetPath);

  if (rule.root) {
    const layout = getTargetLayout(target, scope);
    for (const mirrorPath of getAdditionalRootDecorationPaths(layout)) {
      pushUnique(paths, mirrorPath);
    }
  }

  if (target === 'copilot' && !rule.root && rule.globs.length > 0) {
    pushUnique(paths, copilotInstructionsPath(rule));
  }

  if ((target === 'cline' || target === 'cursor') && rule.root && scope === 'project') {
    pushUnique(paths, 'AGENTS.md');
  }

  if (target === 'windsurf' && scope === 'project') {
    if (rule.root) {
      pushUnique(paths, 'AGENTS.md');
    } else {
      const dir = directoryScopedRuleDir(rule.globs);
      if (dir) pushUnique(paths, `${dir}/AGENTS.md`);
    }
  }

  if (target === 'gemini-cli') {
    pushUnique(paths, GEMINI_COMPAT_AGENTS);
  }

  if (target === 'codex-cli') {
    if (!rule.root && rule.codexEmit === 'execution') {
      const slug = rule.source.split('/').pop()!.replace(/\.md$/, '');
      pushUnique(paths, `${CODEX_RULES_DIR}/${slug}.rules`);
    }
  }

  return paths;
}
