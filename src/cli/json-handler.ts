/**
 * JSON mode orchestration helper.
 * Decides whether to render human output or emit a JSON envelope.
 */

import { emitJson } from './json-output.js';

interface CommandOutput {
  exitCode: number;
  data: unknown;
}

/**
 * Handles command result: emits JSON in json mode, otherwise renders and exits.
 */
export function handleResult(
  command: string,
  result: CommandOutput,
  flags: Record<string, string | boolean>,
  render: () => void,
): void {
  if (flags.json === true) {
    const success = result.exitCode === 0;
    emitJson(
      command,
      success
        ? { success: true, data: result.data }
        : { success: false, error: `Command '${command}' failed`, data: result.data },
    );
    process.exit(result.exitCode);
    return; // unreachable at runtime; guards against mocked process.exit in tests
  }
  render();
  if (result.exitCode !== 0) process.exit(result.exitCode);
}
