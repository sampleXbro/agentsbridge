/**
 * Codex CLI target linter — validates canonical files for Codex.
 * Codex needs a root rule for AGENTS.md generation and otherwise relies on feature-specific
 * generators for commands, projected agents, skills, and MCP.
 */

import { relative } from 'node:path';
import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { CODEX_TARGET } from './constants.js';

/**
 * Lint rules for Codex target.
 * Codex requires a root rule to generate AGENTS.md.
 * Uses warning (not error) when no root because Codex generation is still useful for other
 * features, but AGENTS.md remains the primary project instruction file.
 *
 * @param canonical - Loaded canonical files
 * @param projectRoot - Project root (for relative paths)
 * @param _projectFiles - Unused here (nested advisory paths derive from globs at generate time)
 * @returns Diagnostics for this target
 */
export function lintRules(
  canonical: CanonicalFiles,
  projectRoot: string,
  _projectFiles: string[],
): LintDiagnostic[] {
  const { rules } = canonical;
  if (rules.length === 0) return [];

  const hasRoot = rules.some((r) => r.root);
  if (!hasRoot) {
    return [
      {
        level: 'warning',
        file: relative(projectRoot, rules[0]!.source),
        target: CODEX_TARGET,
        message: 'Codex needs a root rule to generate AGENTS.md. Add root: true to a rule.',
      },
    ];
  }
  return [];
}
