import { logger } from '../utils/output/logger.js';
import { emitJson } from './json-output.js';

export interface HandleErrorOptions {
  verbose?: boolean;
  json?: boolean;
  command?: string;
}

/**
 * Handles CLI errors: prints message and exits with code 1.
 * In JSON mode, emits a JSON envelope to stdout instead of stderr.
 */
export function handleError(err: Error, options?: HandleErrorOptions): never {
  if (options?.json) {
    emitJson(options.command ?? 'unknown', { success: false, error: err.message });
    return process.exit(1);
  }

  if (options?.verbose && err.stack) {
    process.stderr.write(err.stack + '\n');
  } else {
    logger.error(err.message);
  }
  process.exit(1);
}
