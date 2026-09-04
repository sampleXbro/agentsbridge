/**
 * Nested `<dir>/AGENTS.md` grouping, shared by the generator and the linter.
 *
 * The path is SHARED with Codex CLI, which walks the same directories but
 * filters rules differently: `codexEmit: execution` is diverted to
 * `.codex/rules/*.rules`, `codexInstructionVariant: override` to
 * `<dir>/AGENTS.override.md`, and `rule.targets` may exclude either tool.
 * Codebuff has none of those surfaces, so it keeps every eligible rule as prose
 * in one file.
 *
 * `resolveOutputCollisions` keeps ONE file per path. It prefers the string that
 * literally CONTAINS the other; failing that, a codex-vs-other AGENTS.md
 * conflict is resolved by picking the LONGER string (silently dropping the
 * other side's rules) and throws outright on an exact length tie. Ordering the
 * rules Codex also emits FIRST — in Codex's own order — keeps Codex's exact
 * string a contiguous prefix of Codebuff's, so containment resolves the
 * collision losslessly whenever Codex has no rules Codebuff omits.
 */

import type { CanonicalFiles, CanonicalRule } from '../../core/types.js';
import { CODEX_CLI_TARGET_ID } from '../catalog/target-ids.js';
import { codebuffNestedKnowledgePath } from './rule-paths.js';
import { CODEBUFF_TARGET } from './constants.js';

function allows(rule: CanonicalRule, target: string): boolean {
  return rule.targets.length === 0 || rule.targets.includes(target);
}

/** Non-root rules this target is allowed to emit. */
export function eligibleRules(canonical: CanonicalFiles): CanonicalRule[] {
  return canonical.rules.filter((rule) => !rule.root && allows(rule, CODEBUFF_TARGET));
}

/** Rules Codex CLI also writes into the same nested `<dir>/AGENTS.md`. */
function alsoWrittenByCodex(rule: CanonicalRule): boolean {
  if (rule.codexEmit === 'execution') return false;
  if (rule.codexInstructionVariant === 'override') return false;
  return allows(rule, CODEX_CLI_TARGET_ID);
}

/** Group by nested path, rules Codex also emits first so its string stays contiguous. */
export function groupByNestedPath(rules: readonly CanonicalRule[]): Map<string, CanonicalRule[]> {
  const shared = rules.filter(alsoWrittenByCodex);
  const extra = rules.filter((rule) => !alsoWrittenByCodex(rule));
  const groups = new Map<string, CanonicalRule[]>();
  for (const rule of [...shared, ...extra]) {
    const path = codebuffNestedKnowledgePath(rule);
    const existing = groups.get(path);
    if (existing) existing.push(rule);
    else groups.set(path, [rule]);
  }
  return groups;
}

export interface NestedFilterConflict {
  path: string;
  leaked: string[];
  contested: string[];
}

/** Split never yields an empty array, so `pop()` is always a string here. */
function ruleName(rule: CanonicalRule): string {
  return rule.source.split(/[\\/]/).pop()!;
}

function push(into: Map<string, NestedFilterConflict>, path: string): NestedFilterConflict {
  const existing = into.get(path);
  if (existing) return existing;
  const created: NestedFilterConflict = { path, leaked: [], contested: [] };
  into.set(path, created);
  return created;
}

/**
 * Per-path report of `targets:` filters a shared nested file cannot honour.
 *
 * `leaked` are rules Codebuff writes even though they name a target subset —
 * every AGENTS.md-reading tool loads the file, so the filter is advisory only.
 * `contested` are rules filtered AWAY from Codebuff that resolve to a path
 * Codebuff also writes, so the two tools want different bytes at one path.
 */
export function nestedFilterConflicts(canonical: CanonicalFiles): NestedFilterConflict[] {
  const emitted = new Set(groupByNestedPath(eligibleRules(canonical)).keys());
  const conflicts = new Map<string, NestedFilterConflict>();

  for (const rule of canonical.rules) {
    if (rule.root || rule.targets.length === 0) continue;
    const path = codebuffNestedKnowledgePath(rule);
    if (!emitted.has(path)) continue;
    const entry = push(conflicts, path);
    if (allows(rule, CODEBUFF_TARGET)) entry.leaked.push(ruleName(rule));
    else entry.contested.push(ruleName(rule));
  }

  return [...conflicts.values()];
}
