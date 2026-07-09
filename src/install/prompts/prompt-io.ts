/**
 * Injectable stdin/stdout adapter for interactive install prompts.
 *
 * Scope: prompt orchestration code (bulk-prompt, broken-link-prompt, modified-
 * files-prompt) consumes this adapter so prompt UX can be exercised in tests
 * without piping real stdin. The default values bind to `process.stdin` /
 * `process.stdout`, preserving runtime behavior identical to the legacy
 * `install/core/prompts.ts` helper.
 *
 * EOF contract: when the input stream ends without yielding a line (Ctrl-D,
 * non-TTY closure, or a pre-ended stream) `readLine` resolves to `''`. The
 * caller distinguishes EOF from a deliberate Enter only when it needs to —
 * the prompt-io adapter intentionally collapses both to the empty string so
 * callers can treat "no input" uniformly.
 */

import * as readline from 'node:readline';

export interface PromptIOOptions {
  readonly input?: NodeJS.ReadableStream;
  readonly output?: NodeJS.WritableStream;
}

export function readLine(prompt: string, options?: PromptIOOptions): Promise<string> {
  const input = options?.input ?? process.stdin;
  const output = options?.output ?? process.stdout;

  return new Promise((resolve) => {
    const rl = readline.createInterface({ input, output, terminal: false });
    let answered = false;
    rl.on('close', () => {
      if (!answered) resolve('');
    });
    // A stream 'error' (broken pipe, terminal disconnect, SSH drop) would
    // otherwise throw an unhandled event and crash the process. Collapse it to
    // the same EOF contract: resolve '' so callers uniformly treat it as "no
    // input" (decline) instead of hanging or crashing.
    rl.on('error', () => {
      if (!answered) {
        answered = true;
        resolve('');
      }
    });
    rl.question(prompt, (answer) => {
      answered = true;
      rl.close();
      resolve(answer);
    });
  });
}
