// SHA-256 hashing

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

/**
 * Returns SHA-256 hex hash of content.
 * @param content - String to hash
 * @returns Lowercase hex string (64 chars)
 */
export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Returns SHA-256 hex hash of file content, or null if file doesn't exist.
 * Hashes raw bytes (no UTF-8 round-trip) so binary supporting files in skill
 * bundles (`.png`, scripts with non-UTF-8 bytes) produce stable digests for
 * the install manifest's modification-detection contract.
 * @param path - File path
 * @returns Hash or null
 */
export async function hashFile(path: string): Promise<string | null> {
  try {
    const bytes = await readFile(path);
    return createHash('sha256').update(bytes).digest('hex');
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}
