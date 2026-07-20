/**
 * Generate .cline/hooks/{event}-{index}.sh from canonical hooks.
 * Cline hooks are deterministic shell scripts. Project scope resolves
 * `.cline/hooks/` against the project root; global scope resolves the same
 * relative path against `$HOME` (CLI docs: `~/.cline/hooks`, also
 * configurable via `--hooks-dir`/`CLINE_HOOKS_DIR`) — no path rewrite needed
 * between scopes.
 */

import type { CanonicalFiles } from '../../core/types.js';
import { hasHookCommand } from '../../core/hook-command.js';
import { CLINE_HOOKS_DIR } from './constants.js';
import type { RulesOutput } from './generator.js';

function safeEventName(event: string): string {
  return event.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
}

// CR/LF in event/matcher/command would otherwise break out of the comment
// header and inject executable lines BEFORE `set -eu` enables strict mode.
// Canonical hooks parser permits arbitrary YAML strings, so a remote pack
// pulled via `extends:` could carry multi-line values.
function safeShellLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ');
}

function buildHookScript(event: string, command: string, matcher: string): string {
  return [
    '#!/usr/bin/env bash',
    `# agentsmesh-event: ${safeShellLine(event)}`,
    `# agentsmesh-matcher: ${safeShellLine(matcher)}`,
    `# agentsmesh-command: ${safeShellLine(command)}`,
    'set -eu',
    command,
    '',
  ].join('\n');
}

/**
 * @param canonical - Loaded canonical files
 * @returns Array of hook script outputs, or [] if no hooks
 */
export function generateHooks(canonical: CanonicalFiles): RulesOutput[] {
  if (!canonical.hooks || Object.keys(canonical.hooks).length === 0) return [];
  const outputs: RulesOutput[] = [];
  for (const [event, entries] of Object.entries(canonical.hooks)) {
    if (!Array.isArray(entries)) continue;
    let index = 0;
    for (const entry of entries) {
      if (!hasHookCommand(entry)) continue;
      outputs.push({
        path: `${CLINE_HOOKS_DIR}/${safeEventName(event)}-${index}.sh`,
        content: buildHookScript(event, entry.command, entry.matcher),
      });
      index++;
    }
  }
  return outputs;
}
