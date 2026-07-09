/**
 * Interactive install prompts (TTY only).
 *
 * Delegates to the shared `readLine` primitive so it inherits its EOF/error
 * safety: a closed or erroring stdin resolves to '' → decline, instead of
 * hanging on an unresolved promise (the old inline readline had no 'close'/
 * 'error' handler and hung on Ctrl-D / crashed on stream errors).
 */

import { readLine } from '../prompts/prompt-io.js';

export async function confirm(message: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const answer = (await readLine(`${message} (y/n) `)).trim().toLowerCase();
  return answer === 'y' || answer === 'yes';
}
