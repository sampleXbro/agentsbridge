/**
 * Uninstall modification prompt: when `agentsmesh uninstall` detects that
 * a pack's files have drifted from their install-time manifest, surface the
 * drift to the user and let them choose between three actions:
 *
 *   [d]elete-anyway  - proceed with rm-rf of the pack dir; user-edited
 *     bytes are lost.
 *   [k]eep-modified  - skip the disk delete for THIS pack (but still drop
 *     the installs.yaml + extends entries); modified files remain on disk
 *     under `.agentsmesh/packs/<name>/`.
 *   [a]bort          - abort the entire uninstall run; exit 130. No writes,
 *     no state change.
 *
 * Mirrors `broken-link-prompt.ts`:
 *   - `bypass: true` (from `--force`, `--json`, non-TTY): defaults to
 *     `delete-anyway`, prints a banner, asks nothing.
 *   - Blank input, EOF, and any unrecognized response abort the run.
 *   - The prompt is pure: it owns no streams and does not apply removals.
 *     The orchestrator (P11) consumes the returned action and routes it
 *     through `apply-uninstall`.
 *
 * Empty `modifications` is degenerate (the caller should not invoke us
 * then) but we accept it for safety and short-circuit to `proceed`.
 */

import type { ModifiedFile } from '../uninstall/detect-modified.js';
import type { PromptAdapter } from './prompt-types.js';

export type ModifiedFilesAction = 'proceed' | 'delete-anyway' | 'keep-modified' | 'abort';

export interface ModifiedFilesPromptInput {
  readonly packName: string;
  readonly modifications: readonly ModifiedFile[];
}

export interface ModifiedFilesPromptOptions {
  /** `--force` / `--json` / non-TTY: defaults to `delete-anyway`. */
  readonly bypass: boolean;
}

export interface ModifiedFilesPromptResult {
  readonly action: ModifiedFilesAction;
}

function writeBanner(deps: PromptAdapter, input: ModifiedFilesPromptInput): void {
  const count = input.modifications.length;
  const label = count === 1 ? 'file' : 'files';
  const lines: string[] = [`Pack "${input.packName}" has ${count} locally modified ${label}:`];
  for (const m of input.modifications) {
    lines.push(`  - ${m.relativePath} (${m.status})`);
  }
  lines.push('');
  deps.write(`${lines.join('\n')}\n`);
}

export async function runModifiedFilesPrompt(
  input: ModifiedFilesPromptInput,
  options: ModifiedFilesPromptOptions,
  deps: PromptAdapter,
): Promise<ModifiedFilesPromptResult> {
  if (input.modifications.length === 0) {
    return { action: 'proceed' };
  }

  if (options.bypass) {
    writeBanner(deps, input);
    return { action: 'delete-anyway' };
  }

  writeBanner(deps, input);
  const answer = (
    await deps.ask(
      'Action: [d]elete anyway / [k]eep modified files (uninstall the rest) / [a]bort ',
    )
  )
    .trim()
    .toLowerCase();

  if (answer === 'd') return { action: 'delete-anyway' };
  if (answer === 'k') return { action: 'keep-modified' };
  return { action: 'abort' };
}
