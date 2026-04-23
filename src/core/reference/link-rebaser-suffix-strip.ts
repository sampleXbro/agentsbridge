import { pathApi, normalizeForProject, normalizeSeparators } from '../path-helpers.js';
import { isRootRelativePathToken } from './link-rebaser-helpers.js';

/**
 * Suffix-strip fallback for tool-specific root-relative paths (e.g. `.codex/skills/figma/references/file.md`).
 * Progressively strips leading segments and checks whether the remaining suffix exists below the destination.
 */
export function resolveByDestinationSuffixStrip(
  token: string,
  projectRoot: string,
  destinationFile: string,
  pathExists: (absolutePath: string) => boolean,
): string | null {
  const api = pathApi(projectRoot);
  const normalizedToken = normalizeSeparators(token);

  if (!isRootRelativePathToken(normalizedToken)) return null;

  const segments = normalizedToken.split('/').filter((s) => s.length > 0);
  if (segments.length < 3) return null;

  const destFilePath = normalizeForProject(projectRoot, destinationFile);
  const destDir = api.dirname(destFilePath);

  for (let i = 1; i <= segments.length - 1; i++) {
    const suffix = segments.slice(i).join('/');
    const candidate = normalizeForProject(projectRoot, api.join(destDir, suffix));
    if (candidate === destFilePath) continue;
    if (pathExists(candidate)) return candidate;
  }
  return null;
}
