/**
 * Aider target constants.
 *
 * Aider is an open-source AI pair programming tool (aider.chat).
 *
 *   - **Project config**: `CONVENTIONS.md` at project root + `.aider/skills/` + `.aiderignore`
 *   - **Global config**: `~/CONVENTIONS.md`, `~/.aider/skills/`, `~/.aiderignore`
 *
 * Aider reads `CONVENTIONS.md` as its primary instruction file. Non-root rules
 * are embedded in the same file. Skills are stored in `.aider/skills/`. Ignore
 * patterns go in `.aiderignore`.
 */

export const AIDER_TARGET = 'aider';

// Project-level paths
export const AIDER_CONVENTIONS = 'CONVENTIONS.md';
export const AIDER_SKILLS_DIR = '.aider/skills';
export const AIDER_IGNORE = '.aiderignore';

// Global-level paths (user home directory)
export const AIDER_GLOBAL_CONVENTIONS = 'CONVENTIONS.md';
export const AIDER_GLOBAL_SKILLS_DIR = '.aider/skills';
export const AIDER_GLOBAL_IGNORE = '.aiderignore';

// Canonical paths
export const AIDER_CANONICAL_RULES_DIR = '.agentsmesh/rules';
export const AIDER_CANONICAL_IGNORE = '.agentsmesh/ignore';
