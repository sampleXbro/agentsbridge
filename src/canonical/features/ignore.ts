/**
 * Parse .agentsmesh/ignore into gitignore-style patterns.
 */

import { readFileSafe } from '../../utils/filesystem/fs.js';
import type { IgnorePatterns } from '../../core/types.js';

/**
 * Parse ignore file at the given path.
 * @param ignorePath - Absolute path to .agentsmesh/ignore
 * @returns Array of ignore patterns (empty array if file missing or empty)
 */
export async function parseIgnore(ignorePath: string): Promise<IgnorePatterns> {
  const content = await readFileSafe(ignorePath);
  if (content === null || !content.trim()) return [];

  const lines = content.split(/\r?\n/);
  const patterns: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    patterns.push(trimmed);
  }

  return patterns;
}
