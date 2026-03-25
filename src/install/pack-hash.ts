/**
 * Content hashing for pack integrity.
 */

import { relative } from 'node:path';
import { readDirRecursive } from '../utils/fs.js';
import { hashFile, hashContent } from '../utils/hash.js';

const PACK_YAML = 'pack.yaml';

/**
 * Compute sha256 fingerprint of all files in packDir, excluding pack.yaml.
 * Returns a stable hash string prefixed with "sha256:".
 */
export async function hashPackContent(packDir: string): Promise<string> {
  const files = await readDirRecursive(packDir);

  const entries: string[] = [];
  for (const fullPath of files.sort()) {
    const rel = relative(packDir, fullPath).replace(/\\/g, '/');
    if (rel === PACK_YAML) continue;
    const h = await hashFile(fullPath);
    if (h !== null) {
      entries.push(`${rel}:${h}`);
    }
  }

  const fingerprint = entries.join('\n');
  const hex = hashContent(fingerprint);
  return `sha256:${hex}`;
}
