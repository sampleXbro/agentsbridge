import { CanonicalParseError } from '../../core/errors.js';

export type ParseErrorCallback = (err: Error, filePath: string) => void;

/**
 * Strict (no callback): throw, so generate/check/lint never silently treat a
 * broken file as absent. Lenient (callback): report and skip, for install-time
 * loads of third-party content.
 */
export function failSyntax(
  filePath: string,
  cause: unknown,
  onParseError?: ParseErrorCallback,
): null {
  const error = new CanonicalParseError(filePath, cause);
  if (onParseError !== undefined) {
    onParseError(error, filePath);
    return null;
  }
  throw error;
}
