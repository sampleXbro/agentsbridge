/**
 * Lint guard: a canonical rule with
 * `trigger: 'manual'` (e.g. a Cursor rule with `alwaysApply: false` and no
 * globs/description) is only loaded when the user @-mentions it. Most targets
 * load every rule file unconditionally, which inverts the activation semantic
 * from "never auto-load" to "always auto-load".
 *
 * The fix is visibility, not silent magic — emit a warning so the user can
 * either constrain the rule to Cursor (`targets: [cursor]`), reauthor it as a
 * skill with disable-model-invocation semantics, or drop it.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../types.js';
import { createWarning } from './helpers.js';

export interface RuleScopeInversionInput {
  readonly target: string;
  readonly canonical: CanonicalFiles;
  readonly preservesManualActivation?: boolean;
}

export function lintRuleScopeInversion(input: RuleScopeInversionInput): LintDiagnostic[] {
  if (input.preservesManualActivation) return [];
  const out: LintDiagnostic[] = [];
  for (const rule of input.canonical.rules) {
    if (rule.root) continue;
    if (rule.trigger !== 'manual') continue;
    if (rule.targets.length > 0 && !rule.targets.includes(input.target)) continue;
    out.push(
      createWarning(
        rule.source,
        input.target,
        `Rule has trigger: 'manual' (Cursor-style "@-mention only" activation), but ${input.target} loads every rule unconditionally. The rule will become always-on for ${input.target} — restrict it with \`targets: [cursor]\`, convert it to a skill with manual invocation, or remove it.`,
      ),
    );
  }
  return out;
}
