import { logger } from '../utils/output/logger.js';

/**
 * Handles CLI errors: prints message and exits with code 1.
 * @param err - The error to handle
 * @param options - verbose: include stack trace
 */
export function handleError(err: Error, options?: { verbose?: boolean }): never {
  if (options?.verbose && err.stack) {
    process.stderr.write(err.stack + '\n');
  } else {
    logger.error(err.message);
  }
  process.exit(1);
}
