import { join } from 'node:path';
import { homedir } from 'node:os';

/**
 * Resolves a global config root string containing '~/' to the actual absolute home directory.
 */
export function resolveGlobalRoot(globalConfigRoot: string): string {
  if (globalConfigRoot === '~') {
    return homedir();
  }
  if (globalConfigRoot.startsWith('~/')) {
    return join(homedir(), globalConfigRoot.slice(2));
  }
  return globalConfigRoot;
}

/**
 * Resolves the final output path for a generated file.
 *
 * If isGlobalMode is false, it returns the generatorOutputPath (which is relative to projectRoot).
 * If isGlobalMode is true, it rebases the path from localConfigRoot to globalConfigRoot.
 *
 * @param generatorOutputPath The raw relative path provided by the target generator.
 * @param localConfigRoot The target's local project footprint folder (e.g. '.claude').
 * @param globalConfigRoot The target's global footprint folder (e.g. '~/.claude').
 * @param isGlobalMode Whether global mode generation is currently active.
 * @returns The final filesystem-ready path (relative to project Root if local, absolute if global).
 */
export function resolveTargetPath(
  generatorOutputPath: string,
  localConfigRoot: string,
  globalConfigRoot: string | undefined,
  isGlobalMode: boolean,
): string {
  if (!isGlobalMode) {
    return generatorOutputPath;
  }

  if (!globalConfigRoot) {
    throw new Error('Target does not support global mode configuration.');
  }

  const resolvedGlobal = resolveGlobalRoot(globalConfigRoot);

  const pathPart = generatorOutputPath.replace(/\\/g, '/');
  // Normalize localConfigRoot: remove trailing slash and convert backslashes
  const normalizedRoot = localConfigRoot
    ? localConfigRoot.replace(/\\/g, '/').replace(/\/$/, '')
    : '';
  const rootPart = normalizedRoot ? normalizedRoot + '/' : '';

  if (rootPart && pathPart.startsWith(rootPart)) {
    // Strip the localConfigRoot (e.g. .claude/rules/foo.md -> rules/foo.md)
    const stripped = pathPart.slice(rootPart.length);
    return join(resolvedGlobal, stripped);
  }

  // Scattered project root file (e.g. CLAUDE.md) flattens directly into the global config folder
  return join(resolvedGlobal, pathPart);
}
