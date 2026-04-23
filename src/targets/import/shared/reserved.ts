/**
 * Reserved artifact names that should be filtered during skill import.
 * These are generated or internal files that should not be imported into canonical.
 */

/**
 * Reserved filename patterns that should be excluded from skill imports.
 * These include:
 * - Hidden files (starting with .)
 * - Generated agent/command prefixes (_ab-agent-, _ab-command-)
 * - Fixture/test files
 */
export const RESERVED_SKILL_PATTERNS = [
  /^\./, // Hidden files
  /^_ab-agent-/, // Generated agent prefixes
  /^_ab-command-/, // Generated command prefixes
  /\.fixture\./, // Fixture files
  /\.test\./, // Test files
] as const;

/**
 * Reserved directory names that should be excluded from skill imports.
 */
export const RESERVED_SKILL_DIRS = ['node_modules', '.git', 'dist', 'coverage'] as const;

/**
 * Check if a filename matches any reserved pattern.
 */
export function isReservedArtifactName(name: string): boolean {
  return RESERVED_SKILL_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Check if a directory name is reserved.
 */
export function isReservedDirectory(name: string): boolean {
  return RESERVED_SKILL_DIRS.includes(name as never);
}
