/**
 * Lint guard that warns when a canonical hook command references a script file
 * (e.g. `./scripts/foo.sh`) for a target whose generator does not copy script
 * assets into the generated tree.
 *
 * Only Copilot's `addHookScriptAssets` post-processing currently copies script
 * files. Every other hooks-supporting target (claude-code, cursor, windsurf,
 * cline) emits the hook config with the original `command` string intact, so
 * users would otherwise ship configs pointing at missing files.
 *
 * The warning is emitted unconditionally for every target except Copilot. Even
 * Copilot's asset projection is best-effort (paths must resolve under the
 * project root), so a stricter variant could include Copilot too — for now the
 * conservative rule is "tell the user the script must already exist where the
 * hook config will execute it" for every non-Copilot target.
 */

import type { CanonicalFiles, LintDiagnostic } from '../../types.js';
import { createWarning } from './helpers.js';

const SCRIPT_REFERENCE_RE =
  /^(?:\s*(?:bash|sh|zsh|pwsh|powershell)\s+)?["']?(?<path>(?:\.{1,2}\/|[^/\s"'`]+\/)[^\s"'`]+)["']?(?:\s|$)/;

export interface HookScriptReferencesInput {
  readonly target: string;
  readonly canonical: CanonicalFiles;
  readonly hasScriptProjection?: boolean;
}

function extractScriptToken(command: string): string | null {
  const match = command.match(SCRIPT_REFERENCE_RE);
  const token = match?.groups?.['path'];
  return typeof token === 'string' ? token : null;
}

export function lintHookScriptReferences(input: HookScriptReferencesInput): LintDiagnostic[] {
  if (input.hasScriptProjection) return [];
  const hooks = input.canonical.hooks;
  if (!hooks) return [];

  const out: LintDiagnostic[] = [];
  for (const entries of Object.values(hooks)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (typeof entry?.command !== 'string') continue;
      const token = extractScriptToken(entry.command);
      if (!token) continue;
      out.push(
        createWarning(
          '.agentsmesh/hooks.yaml',
          input.target,
          `${input.target} hook command references script "${token}"; agentsmesh does not copy hook scripts into ${input.target} output, so the script must already exist relative to the hook execution directory or the generated config will fail.`,
        ),
      );
    }
  }
  return out;
}
