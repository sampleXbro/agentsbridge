/**
 * Custom error class for CLI usage errors.
 * When caught by handleError, these exit with code 2 instead of 1.
 */
export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliUsageError';
  }
}
