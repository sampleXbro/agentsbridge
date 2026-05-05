import { logger } from '../utils/output/logger.js';
import { emitJson } from './json-output.js';
import { CliUsageError } from './cli-error.js';

export interface HandleErrorOptions {
  verbose?: boolean;
  json?: boolean;
  command?: string;
}

/**
 * Handles CLI errors: prints message and exits.
 * CliUsageError exits with code 2; all other errors exit with code 1.
 * In JSON mode, emits a JSON envelope to stdout instead of stderr.
 */
export function handleError(err: Error, options?: HandleErrorOptions): never {
  const exitCode = err instanceof CliUsageError ? 2 : 1;

  if (options?.json) {
    emitJson(options.command ?? 'unknown', { success: false, error: err.message });
    return process.exit(exitCode);
  }

  if (options?.verbose && err.stack) {
    process.stderr.write(err.stack + '\n');
  } else {
    logger.error(err.message);
  }
  process.exit(exitCode);
}
