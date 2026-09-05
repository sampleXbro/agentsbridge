import { normalizeRecallFile } from './normalize-query-file.js';

/**
 * A `contextKey` binds an outcome (a lesson delivered, or a failure observed) to
 * the concrete ACTION about to happen — the file being edited or the command
 * class being run. A delivery and a later failure on the SAME action share this
 * key, which is how effectiveness attributes a recurrence to the lesson meant to
 * prevent it. It is the action ONLY — the error class is recorded separately and
 * is never folded in here, because the `delivered` event is emitted before any
 * error exists, so an error-bearing key could never match its later `failure`.
 */

/**
 * Reduce a shell command to a stable class — the program plus optional
 * subcommand — so outcomes bind to the action, not its varying arguments:
 *   "git commit -m 'wip'" → "git commit";  "tsc --noEmit src/x.ts" → "tsc".
 * A subcommand is the bare word DIRECTLY after the program; past a flag, a bare
 * word is an operand ("rm -rf build" → "rm"), so it never fragments the class.
 */
export function normalizeCommand(command: string): string {
  const words = command.trim().split(/\s+/);
  // Drop leading `VAR=val` env assignments so `FOO=1 npm test` and `npm test` share a class.
  let start = 0;
  while (start < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[start]!)) start += 1;
  const rest = words.slice(start);
  const programIdx = rest.findIndex(isBareWord);
  // A command that is ONLY env assignments (`FOO=bar` — no program) has no class,
  // so it collapses to '' rather than echoing the assignment; a path-shaped
  // program (`./run.sh`) keeps its first token.
  if (programIdx === -1) return rest[0] ?? '';
  const program = rest[programIdx]!;
  const next = rest[programIdx + 1];
  return next !== undefined && isBareWord(next) ? `${program} ${next}` : program;
}

/** Not a flag, not path-like, not a quoted fragment. */
function isBareWord(w: string): boolean {
  return w.length > 0 && !w.startsWith('-') && !w.includes('/') && !/^["'`]/.test(w);
}

/** Deterministic action key. File takes precedence (the tighter signal). Never raw text. */
export function contextKey(
  input: { file?: string; command?: string },
  projectRoot: string,
): string {
  if (input.file !== undefined && input.file.length > 0) {
    return `file:${normalizeRecallFile(input.file, projectRoot)}`;
  }
  if (input.command !== undefined && input.command.length > 0) {
    return `cmd:${normalizeCommand(input.command)}`;
  }
  return 'none';
}
