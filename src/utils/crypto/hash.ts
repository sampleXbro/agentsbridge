// SHA-256 hashing

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  UTF8_BOM,
  shouldNormalizeLineEndings,
  normalizeLineEndings,
} from '../filesystem/fs-text-encoding.js';

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

/**
 * Stable hash of an installed file's content. For text extensions (per
 * `shouldNormalizeLineEndings`), strip a leading UTF-8 BOM and normalize
 * `\r\n?` to `\n` before hashing so a CRLF/BOM rewrite by a Windows editor
 * does not register as drift. Binary files are hashed as raw bytes —
 * identical to `hashFile`.
 *
 * `writeFileAtomic` already normalizes text payloads to LF on write, so the
 * install manifest and the post-install on-disk content match by construction
 * when the editor leaves the file alone. This helper closes the remaining
 * gap where the editor IS Windows / VSCode-with-autocrlf.
 *
 * @param path - File path
 * @returns Hash or null
 */
export async function hashFileForManifest(path: string): Promise<string | null> {
  try {
    if (!shouldNormalizeLineEndings(path)) {
      const bytes = await readFile(path);
      return createHash('sha256').update(bytes).digest('hex');
    }
    let text = await readFile(path, 'utf-8');
    if (text.startsWith(UTF8_BOM)) text = text.slice(UTF8_BOM.length);
    text = normalizeLineEndings(text);
    return createHash('sha256').update(text, 'utf8').digest('hex');
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}
