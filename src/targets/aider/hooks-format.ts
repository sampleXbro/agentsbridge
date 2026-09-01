/**
 * Canonical hooks <-> Aider `.aider.conf.yml`.
 *
 * Aider has no general lifecycle-hook mechanism. It has exactly five config
 * keys that run a shell command for you (aider.chat/docs/usage/lint-test.html
 * and .../config/aider_conf.html):
 *
 *   - `lint-cmd` (a list) + `auto-lint` (default true) — run after aider edits
 *     files, with the edited filenames appended.
 *   - `test-cmd` + `auto-test` (default false) — run the whole suite after
 *     aider edits code; no filenames, not file-scoped.
 *   - `notifications-command` — run when aider needs the user's attention.
 *
 * So the canonical `(event, matcher, command)` triple is projected on the
 * matcher's scope, which is the only honest discriminator aider offers:
 *
 *   PostToolUse + edit-tool matcher  -> `lint-cmd`  (per-edited-file command)
 *   PostToolUse + `*`/empty matcher  -> `test-cmd`  (unscoped command)
 *   Notification                     -> `notifications-command`
 *
 * Everything else — every other event, PostToolUse scoped to a non-edit tool,
 * prompt-type entries, and the second entry for the two single-valued keys —
 * has no key to land in and is reported by `lintHooks`. `*`-matched entries are
 * reported too: aider runs `test-cmd` only after edits, which is narrower than
 * "after any tool use".
 */

import type { HookEntry, Hooks } from '../../core/hook-types.js';
import { BEST_EFFORT_HOOK_EVENTS } from '../../core/hook-types.js';
import { getHookCommand } from '../../core/hook-command.js';

/** The `.aider.conf.yml` keys agentsmesh owns for the hooks feature. */
export const AIDER_HOOK_KEYS = [
  'test-cmd',
  'auto-test',
  'lint-cmd',
  'auto-lint',
  'notifications-command',
] as const;

/** Matcher written for `lint-cmd` entries on import (aider's per-edit hook). */
export const AIDER_LINT_MATCHER = 'Write|Edit';

const EDIT_TOOLS = new Set(['write', 'edit', 'multiedit', 'notebookedit', 'update']);

/** The three keys that carry a command (the other two are their on/off switches). */
export type AiderCommandKey = 'lint-cmd' | 'test-cmd' | 'notifications-command';

export interface AiderHookEntry {
  readonly event: string;
  readonly matcher: string;
  readonly command: string;
}

/** A canonical entry together with the config key it reached. */
export interface AiderMappedEntry extends AiderHookEntry {
  readonly key: AiderCommandKey;
}

export interface AiderHookProjection {
  /** Config keys to write, in `AIDER_HOOK_KEYS` order. */
  readonly keys: Record<string, unknown>;
  /** Canonical entries that reached a config key, tagged with that key. */
  readonly mapped: readonly AiderMappedEntry[];
  /** Canonical entries with no aider key at all. */
  readonly unmapped: readonly AiderHookEntry[];
  /** Entries projected as `test-cmd`, which aider narrows to post-edit runs. */
  readonly narrowed: readonly AiderHookEntry[];
}

/** `edit` — every matcher token is a file-editing tool; `broad` — unscoped. */
function matcherKind(matcher: string): 'edit' | 'broad' | 'other' {
  const trimmed = matcher.trim();
  if (trimmed === '' || trimmed === '*' || trimmed === '.*') return 'broad';
  const tokens = trimmed
    .split('|')
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);
  if (tokens.length > 0 && tokens.every((token) => EDIT_TOOLS.has(token))) return 'edit';
  return 'other';
}

export function projectAiderHooks(hooks: Hooks | null): AiderHookProjection {
  const mapped: AiderMappedEntry[] = [];
  const unmapped: AiderHookEntry[] = [];
  const narrowed: AiderHookEntry[] = [];
  const lintCmds: string[] = [];
  let testCmd: string | null = null;
  let notify: string | null = null;

  function drop(entry: AiderHookEntry): void {
    if (!BEST_EFFORT_HOOK_EVENTS.has(entry.event)) unmapped.push(entry);
  }

  for (const [event, entries] of Object.entries(hooks ?? {})) {
    if (!Array.isArray(entries)) continue;
    for (const raw of entries as HookEntry[]) {
      const command = getHookCommand(raw);
      const item = { event, matcher: raw.matcher ?? '', command };
      if (command === '' || raw.type === 'prompt') {
        drop(item);
        continue;
      }
      if (event === 'Notification') {
        if (notify === null) {
          notify = command;
          mapped.push({ ...item, key: 'notifications-command' });
        } else drop(item);
        continue;
      }
      const kind = event === 'PostToolUse' ? matcherKind(item.matcher) : 'other';
      if (kind === 'edit') {
        lintCmds.push(command);
        mapped.push({ ...item, key: 'lint-cmd' });
      } else if (kind !== 'broad') drop(item);
      else if (testCmd === null) {
        testCmd = command;
        narrowed.push(item);
        mapped.push({ ...item, key: 'test-cmd' });
      } else drop(item);
    }
  }

  const keys: Record<string, unknown> = {};
  if (testCmd !== null) {
    keys['test-cmd'] = testCmd;
    keys['auto-test'] = true;
  }
  if (lintCmds.length > 0) {
    keys['lint-cmd'] = lintCmds;
    keys['auto-lint'] = true;
  }
  if (notify !== null) keys['notifications-command'] = notify;
  return { keys, mapped, unmapped, narrowed };
}
