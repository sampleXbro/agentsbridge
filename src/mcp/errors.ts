export const ERROR_CODES = {
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_NAME: 'INVALID_NAME',
  PATH_TRAVERSAL: 'PATH_TRAVERSAL',
  PROTECTED_FILE: 'PROTECTED_FILE',
  LOCK_HELD: 'LOCK_HELD',
  NO_PROJECT: 'NO_PROJECT',
  IO_ERROR: 'IO_ERROR',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

const ABSOLUTE_PATH_RE = /(^|\s)\/[A-Za-z]|^[A-Z]:[\\/]/;

export class McpError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;
  constructor(code: ErrorCode, message: string, details?: unknown) {
    if (ABSOLUTE_PATH_RE.test(message)) {
      throw new Error(`McpError refuses absolute fs path in message: ${message}`);
    }
    super(message);
    this.code = code;
    this.details = details;
  }
  toEnvelope(): { code: ErrorCode; message: string; details?: unknown } {
    return this.details === undefined
      ? { code: this.code, message: this.message }
      : { code: this.code, message: this.message, details: this.details };
  }
}

/**
 * Redact filesystem paths from raw `Error.message` strings so non-`McpError`
 * fallbacks (e.g. ENOENT from `node:fs/promises`) do not leak the host's
 * directory layout to MCP clients.
 */
export function redactAbsolutePaths(message: string): string {
  return message
    .replace(/(['"`])\/[^'"`\s]+\1/gu, '$1<redacted>$1')
    .replace(/(\s|^)\/[A-Za-z][^\s'"`]*/gu, '$1<redacted>')
    .replace(/(\s|^)[A-Z]:[\\/][^\s'"`]*/gu, '$1<redacted>');
}
