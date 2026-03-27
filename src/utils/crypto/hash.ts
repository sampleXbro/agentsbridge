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
 * @param path - File path
 * @returns Hash or null
 */
export async function hashFile(path: string): Promise<string | null> {
  try {
    const content = await readFile(path, 'utf8');
    return hashContent(content);
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}
