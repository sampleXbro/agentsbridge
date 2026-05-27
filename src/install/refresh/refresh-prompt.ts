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

export interface ConsentRequestItem {
  readonly name: string;
  readonly modifiedCount: number;
}

export interface ConsentResult {
  readonly proceed: boolean;
  readonly perPack: boolean;
  readonly declined: readonly string[];
}

export interface RunConsentPromptOptions extends PromptWithTimeoutDeps {
  readonly timeoutMs: number;
}

export async function runConsentPrompt(
  items: readonly ConsentRequestItem[],
  options: RunConsentPromptOptions,
): Promise<ConsentResult> {
  const lines = [
    `The following ${items.length} pack(s) have local edits that refresh will overwrite:`,
    ...items.map((i) => `  - ${i.name}: ${i.modifiedCount} modified file(s)`),
    'Continue? [y/N/per-pack]  (5 min timeout, default N) ',
  ];
  const message = lines.join('\n');
  const answer = await promptWithTimeout(message, options.timeoutMs, options);
  switch (answer) {
    case 'y':
      return { proceed: true, perPack: false, declined: [] };
    case 'per-pack':
      return { proceed: true, perPack: true, declined: [] };
    case 'n':
    case 'timeout':
      return {
        proceed: false,
        perPack: false,
        declined: items.map((i) => i.name),
      };
  }
}
