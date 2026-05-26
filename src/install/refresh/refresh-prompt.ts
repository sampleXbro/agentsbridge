/**
 * Consent prompt with a hard timeout. Built on Node primitives only — no
 * platform-specific terminal handling. The `readLine` injection point lets
 * tests mock stdin.
 */

import { readLine as defaultReadLine } from '../prompts/prompt-io.js';

export type PromptAnswer = 'y' | 'n' | 'per-pack' | 'timeout';

export interface PromptWithTimeoutDeps {
  /** Test seam: inject a custom reader for stdin. */
  readonly readLine?: (prompt: string) => Promise<string>;
}

export async function promptWithTimeout(
  message: string,
  timeoutMs: number,
  deps: PromptWithTimeoutDeps = {},
): Promise<PromptAnswer> {
  const reader = deps.readLine ?? defaultReadLine;
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<PromptAnswer>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
    timer.unref?.();
  });

  try {
    const raw = await Promise.race([reader(message), timeout]);
    if (raw === 'timeout') return 'timeout';
    return normalize(raw);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function normalize(raw: string): PromptAnswer {
  const lower = raw.trim().toLowerCase();
  if (lower === 'y' || lower === 'yes') return 'y';
  if (lower === 'per-pack') return 'per-pack';
  return 'n';
}
