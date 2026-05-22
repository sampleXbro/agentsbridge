/**
 * Infer the target tool from .mdc frontmatter shape.
 *
 * Cursor keys: alwaysApply
 * Windsurf keys: trigger (when alwaysApply absent)
 * Ambiguous (both or neither): returns null — user must pass --target.
 */

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import { tryParseFrontmatter } from '../../utils/text/markdown.js';

export async function inferMdcTarget(dirPath: string): Promise<string | null> {
  let entries: string[];
  try {
    entries = await readdir(dirPath);
  } catch {
    return null;
  }
  const mdcFile = entries.sort().find((e) => e.toLowerCase().endsWith('.mdc'));
  if (!mdcFile) return null;

  const content = await readFileSafe(join(dirPath, mdcFile));
  if (!content) return null;

  const parsed = tryParseFrontmatter(content, join(dirPath, mdcFile));
  if (!parsed.ok) return null;
  const { frontmatter } = parsed.value;
  const hasCursorKey = 'alwaysApply' in frontmatter;
  const hasWindsurfKey = 'trigger' in frontmatter;

  if (hasCursorKey && hasWindsurfKey) return null;
  if (hasCursorKey) return 'cursor';
  if (hasWindsurfKey) return 'windsurf';
  return null;
}
