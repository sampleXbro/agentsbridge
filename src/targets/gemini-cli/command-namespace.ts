import { relative } from 'node:path';

/**
 * Convert canonical command names into Gemini CLI nested slash-style command paths.
 *
 * Gemini docs: `.gemini/commands/git/commit.toml` maps to `/git:commit`.
 * This function maps `git:commit` -> `git/commit.toml`.
 */
export function canonicalCommandNameToGeminiTomlPath(cmdName: string, commandsDir: string): string {
  const parts = cmdName.split(':').filter(Boolean);
  const fileBase = parts.length > 0 ? parts.pop()! : cmdName;
  const dirs = parts; // remaining segments
  const fullParts = [commandsDir, ...dirs, `${fileBase}.toml`];
  return fullParts.join('/');
}

/**
 * Convert Gemini CLI nested command file path back to canonical `:`-delimited command name.
 *
 * Example:
 *  srcPath: `<root>/.gemini/commands/git/commit.toml`
 *  => name: `git:commit`
 */
export function geminiTomlPathToCanonicalCommandName(
  srcPath: string,
  geminiCommandsRoot: string,
): string {
  const rel = relative(geminiCommandsRoot, srcPath).replace(/\\/g, '/');
  const noExt = rel.replace(/\.(toml|md)$/i, '');
  const segments = noExt.split('/').filter(Boolean);
  return segments.join(':');
}
