/**
 * Sentinel error raised when the user aborts at an install-time prompt.
 *
 * The orchestrator (`runInstall`) catches this error specifically and
 * resolves with `exitCode: 130` instead of propagating the throw. Other
 * errors continue to surface through the normal CLI error handler with
 * exit code 1.
 */

export class InstallAbortError extends Error {
  readonly aborted = true as const;

  constructor(message: string) {
    super(message);
    this.name = 'InstallAbortError';
  }
}
