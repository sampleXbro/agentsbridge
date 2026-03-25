/**
 * Codex advisory instruction paths per docs/agent-structures/codex-cli-project-level-advanced.md §2.1, §4.1, §6.2:
 * non-execution rules use nested `AGENTS.md` or `AGENTS.override.md`, not `.codex/rules/*.rules`.
 */

import { basename } from 'node:path';
import type { CanonicalRule } from '../../core/types.js';

function sanitizeRelativeDir(rawPrefix: string): string | null {
  const normalized = rawPrefix.replace(/\\/g, '/').replace(/\/+/g, '/');
  const stripped = normalized.startsWith('./') ? normalized.slice(2) : normalized;
  if (stripped.length === 0 || stripped === '.' || stripped === '..') return null;
  if (stripped.startsWith('/') || stripped.startsWith('../') || stripped.includes('/../'))
    return null;
  const segments = stripped.split('/');
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    return null;
  }
  return stripped;
}

function directoryPrefixFromGlob(glob: string): string | null {
  const normalized = glob.replace(/\\/g, '/');
  if (normalized.startsWith('{')) return null;
  const wildcardIndex = normalized.search(/[*{]/);
  if (wildcardIndex < 0) {
    const trimmed = normalized.replace(/\/+$/, '');
    return trimmed.length > 0 ? sanitizeRelativeDir(trimmed) : null;
  }
  if (wildcardIndex === 0) return null;
  const prefix = normalized.slice(0, wildcardIndex).replace(/\/+$/, '');
  return prefix.length > 0 ? sanitizeRelativeDir(prefix) : null;
}

function advisorySubdir(rule: Pick<CanonicalRule, 'source' | 'globs'>): string {
  for (const glob of rule.globs) {
    const prefix = directoryPrefixFromGlob(glob);
    if (prefix !== null && !prefix.includes('**')) return prefix;
  }
  return basename(rule.source, '.md');
}

/**
 * Relative path for an advisory (non-execution) canonical rule: `{dir}/AGENTS.md` or override variant.
 */
export function codexAdvisoryInstructionPath(rule: CanonicalRule): string {
  const dir = advisorySubdir(rule);
  const file = rule.codexInstructionVariant === 'override' ? 'AGENTS.override.md' : 'AGENTS.md';
  return `${dir}/${file}`;
}
