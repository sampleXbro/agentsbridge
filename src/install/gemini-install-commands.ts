/**
 * Infer canonical Gemini command names from native files under a repo path (install).
 */

import { join, relative } from 'node:path';
import { readDirRecursive } from '../utils/fs.js';
import { GEMINI_COMMANDS_DIR } from '../targets/gemini-cli/constants.js';

/** True when pathInRepo (POSIX, trimmed) is `.gemini/commands` or a subpath. */
export function isUnderGeminiCommands(pathInRepoPosix: string): boolean {
  const p = pathInRepoPosix.replace(/^\/+|\/+$/g, '');
  return p === '.gemini/commands' || p.startsWith('.gemini/commands/');
}

/**
 * List canonical command names for native `.toml`/`.md` under pathInRepo, relative to `.gemini/commands`.
 */
export async function inferGeminiCommandNamesFromFiles(
  repoRoot: string,
  pathInRepoPosix: string,
): Promise<string[]> {
  const commandsRoot = join(repoRoot, ...GEMINI_COMMANDS_DIR.split('/'));
  const scanDir = join(repoRoot, ...pathInRepoPosix.split('/'));
  const files = await readDirRecursive(scanDir);
  const names: string[] = [];
  for (const f of files) {
    if (!/\.(toml|md)$/i.test(f)) continue;
    const rel = relative(commandsRoot, f).replace(/\\/g, '/');
    if (rel.startsWith('..') || rel === '') continue;
    const noExt = rel.replace(/\.(toml|md)$/i, '');
    const name = noExt.split('/').filter(Boolean).join(':');
    if (name) names.push(name);
  }
  return [...new Set(names)].sort();
}
