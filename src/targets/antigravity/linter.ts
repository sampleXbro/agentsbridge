import type { CanonicalFiles, LintDiagnostic } from '../../core/types.js';
import { validateRules } from '../../core/lint/validate-rules.js';
import { createWarning } from '../../core/lint/shared/helpers.js';
import { ANTIGRAVITY_TARGET, ANTIGRAVITY_AGENTS_DIR } from './constants.js';

/**
 * `.agents/agents/` is a managed output directory, so stale cleanup deletes
 * every file in it that the run did not emit — that is what makes revoking an
 * agent work. On a workspace where the agents were hand-written rather than
 * generated, the same rule destroys them, so name them while they still exist.
 *
 * Only reachable through `lintRules`, which is gated on the `rules` feature:
 * `projectFiles` is the sole hook that receives the on-disk file list.
 */
function lintOrphanAgentFiles(canonical: CanonicalFiles, projectFiles: string[]): LintDiagnostic[] {
  const generated = new Set(
    canonical.agents.map((agent) => `${ANTIGRAVITY_AGENTS_DIR}/${agent.name}.md`),
  );
  const orphans = projectFiles
    .map((file) => file.replaceAll('\\', '/'))
    .filter((file) => file.startsWith(`${ANTIGRAVITY_AGENTS_DIR}/`) && !generated.has(file))
    .sort();
  if (orphans.length === 0) return [];
  return [
    createWarning(
      ANTIGRAVITY_AGENTS_DIR,
      ANTIGRAVITY_TARGET,
      `agentsmesh manages ${ANTIGRAVITY_AGENTS_DIR}/, so the next generate deletes these files that no canonical agent produces: ${orphans.join(', ')}. Run \`agentsmesh import --from antigravity\` first to keep them.`,
    ),
  ];
}

export function lintRules(
  canonical: CanonicalFiles,
  projectRoot: string,
  projectFiles: string[],
  options?: { scope?: 'project' | 'global' },
): LintDiagnostic[] {
  const diagnostics = validateRules(canonical, projectRoot, projectFiles, {
    checkGlobMatches: options?.scope !== 'global',
  }).map((diagnostic) => ({
    ...diagnostic,
    target: ANTIGRAVITY_TARGET,
  }));
  if (options?.scope === 'global') return diagnostics;
  return [...diagnostics, ...lintOrphanAgentFiles(canonical, projectFiles)];
}
